#!/usr/bin/env bash
#
# 光谷人会议预约（meeting）部署到 s131
#
# 部署模型：本地 push → 服务器 git pull
# ---------------------------------------------------------------
# 服务器上的 /opt/meeting 是一个 git 工作区，源码只可能来自 Git：
#     ssh s131 'cd /opt/meeting && git log -1'
#
# 本项目没有构建步骤：
#   backend/    Node/Express，PM2 常驻（meeting-backend，127.0.0.1:3000）
#   frontend/   微信小程序源码，只在服务器留档、不参与运行
#               （小程序由微信开发者工具上传，服务器上无需也不该构建）
#
# 数据边界（均在 .gitignore 内，git reset --hard 不会触及）：
#   backend/.env           环境变量（数据库连接串、微信密钥等）
#   backend/uploads/       用户上传的会议附件（线上 27 个文件 / 22M）
#   backend/temp/          临时文件
#   backup/                服务器侧备份
#   backend/node_modules/  依赖，服务器不动、不装
# 脚本会在部署前后各取一次指纹（.env 的 md5、uploads 的文件数），
# 不一致就中止 —— 以此证明「数据没被碰」是被验证过的，而不是靠声明。
#
# 用法：./deploy-s131.sh
#      DEPLOY_HOST=别的别名 ./deploy-s131.sh
#      应急跳过闸门：SKIP_GIT_CHECK=1 ./deploy-s131.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
HOST="${DEPLOY_HOST:-s131}"
REMOTE_DIR="/opt/meeting"
BRANCH="main"
PM2_APP="meeting-backend"
HEALTH_URL="http://127.0.0.1:3000/api/health"
cd "$ROOT"

# ---- 前置闸门：保证「线上代码 = Git 里的代码」 ----
# 规则：有未提交改动 -> 拦下（要上线的代码在 Git 里必须查得到）；
#       有已提交但未推送 -> 自动补推（服务器要从 GitHub 拉，不推就拉不到）。
# 应急跳过：SKIP_GIT_CHECK=1 ./deploy-s131.sh
check_git_sync() {
  if [ "${SKIP_GIT_CHECK:-0}" = "1" ]; then
    echo "    [git] SKIP_GIT_CHECK=1，已跳过一致性检查"
    return 0
  fi
  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo "!! [git] 当前目录不是 git 仓库，无法部署"
    return 1
  fi

  if [ -n "$(git status --porcelain)" ]; then
    echo "!! [git] 存在未提交改动，拒绝部署。"
    echo "   理由：这些改动会直接上线，但 Git 中查无此版本，线上将无法追溯。"
    git status --short | sed 's/^/     /'
    echo "   请先 commit，或设 SKIP_GIT_CHECK=1 强制部署。"
    return 1
  fi

  branch="$(git rev-parse --abbrev-ref HEAD)"
  if upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)"; then
    ahead="$(git rev-list --count "${upstream}..HEAD" 2>/dev/null || echo 0)"
    if [ "${ahead:-0}" -gt 0 ]; then
      echo "    [git] 本地领先 ${upstream} ${ahead} 个提交，自动补推…"
      if ! git push origin "$branch"; then
        echo "!! [git] 推送失败，拒绝部署（服务器要从 GitHub 拉取）。"
        return 1
      fi
      echo "    [git] 已推送，GitHub 与本地一致"
    else
      echo "    [git] 已与 ${upstream} 同步"
    fi
  else
    echo "!! [git] 当前分支未设置上游，服务器拉不到，拒绝部署"
    return 1
  fi
  return 0
}

echo "==> [闸门] 检查 Git 同步状态"
check_git_sync || exit 1

# ---- 拉取前：取运行时数据指纹（用于事后证明未被触碰） ----
echo "==> [远程] 拉取前线上版本: $(ssh "$HOST" "cd '$REMOTE_DIR' && git rev-parse --short HEAD")"
env_md5_before="$(ssh "$HOST" "md5sum '$REMOTE_DIR/backend/.env' 2>/dev/null | cut -d' ' -f1")"
uploads_before="$(ssh "$HOST" "find '$REMOTE_DIR/backend/uploads' -type f 2>/dev/null | wc -l | tr -d ' '")"
head_before="$(ssh "$HOST" "cd '$REMOTE_DIR' && git rev-parse HEAD")"

# ---- 服务器拉取 ----
echo "==> [远程] $HOST:$REMOTE_DIR 拉取 origin/$BRANCH"
ssh "$HOST" "cd '$REMOTE_DIR' && git fetch --prune origin && git reset --hard 'origin/$BRANCH'"
head_after="$(ssh "$HOST" "cd '$REMOTE_DIR' && git rev-parse HEAD")"
ssh "$HOST" "cd '$REMOTE_DIR' && echo '    拉取后线上版本: '\$(git log --oneline -1)"

dirty="$(ssh "$HOST" "cd '$REMOTE_DIR' && git status --porcelain")"
if [ -n "$dirty" ]; then
  echo "!! 拉取后工作区仍不干净，请人工确认："
  echo "$dirty" | sed 's/^/     /'
  exit 1
fi

# ---- 数据保护：前后指纹必须一致 ----
echo "==> [校验] 运行时数据未被触碰"
env_md5_after="$(ssh "$HOST" "md5sum '$REMOTE_DIR/backend/.env' 2>/dev/null | cut -d' ' -f1")"
uploads_after="$(ssh "$HOST" "find '$REMOTE_DIR/backend/uploads' -type f 2>/dev/null | wc -l | tr -d ' '")"

if [ -z "$env_md5_before" ] || [ -z "$env_md5_after" ]; then
  echo "!! backend/.env 读不到，请立即检查"
  exit 1
fi
if [ "$env_md5_before" != "$env_md5_after" ]; then
  echo "!! backend/.env 被改动了（$env_md5_before -> ${env_md5_after}），请立即检查"
  exit 1
fi
echo "    backend/.env            未被改动"

if [ "$uploads_before" != "$uploads_after" ]; then
  echo "!! backend/uploads 文件数变化（$uploads_before -> ${uploads_after}），请立即检查"
  exit 1
fi
echo "    backend/uploads         ${uploads_after} 个文件，未被改动"

if ! ssh "$HOST" "test -d '$REMOTE_DIR/backend/node_modules'"; then
  echo "!! backend/node_modules 丢失（服务器上不安装依赖，请从备份恢复）"
  exit 1
fi
echo "    backend/node_modules    在位"

# ---- 依赖变化提示（不自动安装：服务器内存小，且改动依赖应是有意为之） ----
if [ "$head_before" != "$head_after" ]; then
  changed="$(ssh "$HOST" "cd '$REMOTE_DIR' && git diff --name-only '$head_before' '$head_after'")"
  if echo "$changed" | grep -q '^backend/package.json$'; then
    echo "==> [依赖] backend/package.json 有变化，依赖可能需要更新（本脚本不自动安装）"
    echo "    如需安装：ssh $HOST 'cd $REMOTE_DIR/backend && npm install --omit=dev'"
  fi
fi

# ---- 重启（代码无变化则跳过，避免打断使用中的预约页面） ----
if [ "$head_before" = "$head_after" ]; then
  echo "==> [重启] 代码无变化，跳过重启"
else
  echo "==> [重启] PM2 $PM2_APP"
  ssh "$HOST" "pm2 reload '$PM2_APP' --update-env >/dev/null && echo '    已重载'"
  sleep 3
fi

# ---- 版本与健康校验 ----
echo "==> [验证]"
local_rev="$(git rev-parse HEAD)"
remote_rev="$(ssh "$HOST" "cd '$REMOTE_DIR' && git rev-parse HEAD")"
if [ "$local_rev" = "$remote_rev" ]; then
  echo "    版本一致: ${local_rev:0:7}"
else
  echo "!! 版本不一致  本地 ${local_rev:0:7} / 线上 ${remote_rev:0:7}"
  exit 1
fi

code="$(ssh "$HOST" "curl -s -o /dev/null -m 15 -w '%{http_code}' '$HEALTH_URL'")"
echo "    直连 127.0.0.1:3000/api/health → HTTP $code"
if [ "$code" != "200" ]; then
  echo "!! 健康检查未通过，最近日志："
  ssh "$HOST" "pm2 logs '$PM2_APP' --lines 30 --nostream" || true
  exit 1
fi

ext_code="$(ssh "$HOST" "curl -sk -o /dev/null -m 15 -w '%{http_code}' -H 'Host: www.cacophonyem.me' https://127.0.0.1/meeting/api/health")"
echo "    经 nginx /meeting/api/health   → HTTP $ext_code"

echo "==> 部署完成：https://www.cacophonyem.me/meeting/api/health"
