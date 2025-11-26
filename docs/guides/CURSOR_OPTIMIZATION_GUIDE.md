# 🚀 Cursor 开发优化指南

## 📋 目录
1. [核心开发原则](#核心开发原则)
2. [智能提示词库](#智能提示词库)
3. [代码理解技巧](#代码理解技巧)
4. [任务拆分策略](#任务拆分策略)
5. [调试优化方法](#调试优化方法)
6. [自动化工作流](#自动化工作流)
7. [快捷键和命令](#快捷键和命令)

---

## 🎯 核心开发原则

### 1. Context First - 上下文优先
```
在开始任何开发任务前，必须先理解完整的上下文：
• 📖 业务背景和用户需求
• 🏗️ 现有代码架构和设计模式
• 🔗 技术栈和依赖关系
• 🎯 项目目标和约束条件
```

### 2. Step-by-Step - 分步执行
```
将复杂问题分解为可管理的小步骤：
• 🧩 问题拆解 → 制定计划 → 逐步实现 → 验证结果
• 📋 每一步都要有明确的输入、输出和验证标准
• 🔄 支持迭代优化和错误回滚
```

### 3. Task Breakdown - 任务拆分
```
大任务拆分为独立的小任务：
• 🎯 单一职责原则
• 📦 模块化设计
• 🧪 独立测试能力
• 🔧 可复用组件
```

### 4. Deep Thinking - 深度思考
```
在编码前进行充分思考：
• 🤔 真正理解需求本质
• 🏗️ 考虑架构扩展性
• 🔮 预见未来变化
• 🛡️ 识别潜在风险
```

---

## 💬 智能提示词库

### 🔍 代码理解类
```
@codebase 分析这个项目的整体架构和设计模式
@codebase 这个函数/类的作用是什么？它在整个系统中的位置？
@codebase 找到所有调用这个API/函数的地方
@codebase 这个错误可能的原因是什么？相关的代码在哪里？
@codebase 这个功能的数据流是怎样的？从输入到输出的完整路径
```

### 🧩 任务拆分类
```
请帮我将这个复杂功能拆分成多个小任务，每个任务要：
1. 有明确的输入和输出
2. 可以独立测试和验证
3. 符合单一职责原则
4. 包含完整的错误处理
5. 有清晰的接口定义

请按优先级排序这些子任务，并说明它们之间的依赖关系。
```

### 🔧 代码优化类
```
请审查这段代码，重点关注：
1. 是否遵循了项目的编码规范和最佳实践
2. 错误处理是否完善和用户友好
3. 是否有潜在的性能问题和内存泄漏
4. 是否考虑了所有边界情况和异常场景
5. 代码注释是否清晰易懂
6. 是否有重构和优化的空间

请提供具体的改进建议和示例代码。
```

### 🐛 问题诊断类
```
我遇到了这个问题：[详细描述问题现象]

请帮我：
1. 分析可能的根本原因（技术、逻辑、配置等）
2. 提供系统性的诊断方法和步骤
3. 给出多种解决方案，并说明优缺点
4. 考虑如何预防类似问题再次发生
5. 提供相关的测试用例来验证修复效果

请按照问题的紧急程度和影响范围来排序解决方案。
```

### 🏗️ 架构设计类
```
我需要设计一个[功能描述]，请帮我：
1. 分析需求和约束条件
2. 设计整体架构和模块划分
3. 定义清晰的接口和数据结构
4. 考虑扩展性、维护性和性能
5. 识别潜在的技术风险和挑战
6. 提供实现的优先级和里程碑

请使用SOLID原则和适当的设计模式。
```

---

## 🧠 代码理解技巧

### 1. 快速上下文获取
```bash
# 理解项目结构
@codebase 这个项目的目录结构和主要模块是什么？

# 理解数据流
@codebase 用户登录的完整流程是怎样的？涉及哪些文件？

# 理解依赖关系
@codebase 这个组件依赖哪些其他模块？被哪些模块使用？
```

### 2. 问题定位策略
```bash
# 错误追踪
@codebase 这个错误信息出现在哪些地方？可能的触发条件是什么？

# 功能追踪
@codebase 这个功能的实现逻辑在哪里？有哪些相关的配置？

# 性能分析
@codebase 这个操作可能的性能瓶颈在哪里？
```

### 3. 代码质量评估
```bash
# 代码规范检查
请检查这段代码是否符合项目的编码规范

# 最佳实践验证
这段代码是否遵循了相关技术栈的最佳实践？

# 安全性审查
这段代码是否存在安全隐患？
```

---

## 📋 任务拆分策略

### 1. 功能拆分模板
```
大功能：[功能名称]

子任务拆分：
1. 【数据层】设计数据模型和数据库结构
   - 输入：业务需求
   - 输出：数据库设计文档和建表脚本
   - 验证：数据完整性和性能测试

2. 【API层】实现后端接口
   - 输入：数据模型和业务逻辑
   - 输出：RESTful API接口
   - 验证：接口测试和文档

3. 【业务层】实现核心业务逻辑
   - 输入：需求规格和数据接口
   - 输出：业务处理模块
   - 验证：单元测试和集成测试

4. 【界面层】实现用户界面
   - 输入：UI设计和API接口
   - 输出：用户界面组件
   - 验证：用户体验测试

5. 【集成层】系统集成和测试
   - 输入：各个子模块
   - 输出：完整功能
   - 验证：端到端测试
```

### 2. 优先级排序原则
```
1. 🔥 高优先级：核心功能、阻塞性问题
2. 🟡 中优先级：重要功能、性能优化
3. 🟢 低优先级：辅助功能、界面美化

依赖关系考虑：
- 先实现被依赖的基础模块
- 并行开发独立的功能模块
- 最后进行集成和测试
```

---

## 🔍 调试优化方法

### 1. 日志策略
```javascript
// 结构化日志记录
console.log('🔐 [AUTH] 开始用户登录流程', {
    timestamp: new Date().toISOString(),
    userId: user?.id,
    action: 'login_start'
});

console.log('✅ [AUTH] 登录成功', {
    timestamp: new Date().toISOString(),
    userId: user.id,
    duration: Date.now() - startTime
});

console.error('❌ [AUTH] 登录失败', {
    timestamp: new Date().toISOString(),
    error: error.message,
    stack: error.stack,
    context: { userId, loginMethod }
});
```

### 2. 错误处理模式
```javascript
// 统一错误处理
async function handleApiRequest(apiCall, context = {}) {
    try {
        const result = await apiCall();
        console.log('✅ API调用成功', { context, result });
        return result;
    } catch (error) {
        console.error('❌ API调用失败', { 
            context, 
            error: error.message,
            timestamp: Date.now()
        });
        
        // 用户友好的错误提示
        wx.showModal({
            title: '操作失败',
            content: getErrorMessage(error),
            showCancel: true,
            confirmText: '重试',
            success: (res) => {
                if (res.confirm) {
                    // 重试逻辑
                    return handleApiRequest(apiCall, context);
                }
            }
        });
        
        throw error;
    }
}
```

### 3. 性能监控
```javascript
// 性能监控装饰器
function performanceMonitor(target, propertyName, descriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function(...args) {
        const startTime = Date.now();
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        
        console.log(`⏱️ [PERF] ${propertyName} 执行时间: ${duration}ms`);
        
        if (duration > 1000) {
            console.warn(`⚠️ [PERF] ${propertyName} 执行时间过长: ${duration}ms`);
        }
        
        return result;
    };
}
```

---

## ⚡ 自动化工作流

### 1. 部署自动化
```bash
# 使用自动化部署脚本
./deploy.sh "feat: 添加新功能"

# 或者分步执行
git add .
git commit -m "feat: 添加新功能"
git push origin main
ssh root@47.122.68.192 'cd /root/meeting-backend && git pull && npm install && pm2 restart meeting-backend'
```

### 2. 测试自动化
```bash
# 前端测试
npm run test:frontend

# 后端测试
npm run test:backend

# API测试
curl -X POST https://www.cacophonyem.me/meeting/api/test/all
```

### 3. 代码质量检查
```bash
# ESLint检查
npx eslint . --fix

# 代码格式化
npx prettier --write .

# 类型检查（如果使用TypeScript）
npx tsc --noEmit
```

---

## ⌨️ 快捷键和命令

### Cursor 快捷键
```
Ctrl/Cmd + K: 打开命令面板
Ctrl/Cmd + Shift + P: 打开所有命令
Ctrl/Cmd + /: 切换注释
Ctrl/Cmd + D: 选择下一个相同的词
Ctrl/Cmd + Shift + L: 选择所有相同的词
Ctrl/Cmd + F: 查找
Ctrl/Cmd + Shift + F: 全局查找
Ctrl/Cmd + H: 替换
Ctrl/Cmd + Shift + H: 全局替换
```

### 微信开发者工具快捷键
```
Ctrl/Cmd + Shift + I: 打开调试器
Ctrl/Cmd + R: 重新编译
Ctrl/Cmd + Shift + R: 清缓存重新编译
Ctrl/Cmd + Shift + M: 打开模拟器
```

### Git 常用命令
```bash
# 快速提交
git add . && git commit -m "feat: 功能描述" && git push

# 查看状态
git status --short

# 查看日志
git log --oneline -10

# 撤销更改
git checkout -- filename
git reset HEAD~1  # 撤销最后一次提交
```

---

## 🎯 最佳实践总结

### 开发前准备
1. ✅ 充分理解需求和上下文
2. ✅ 分析现有代码结构
3. ✅ 制定详细的实现计划
4. ✅ 准备测试用例和验证方法

### 开发过程中
1. ✅ 遵循单一职责原则
2. ✅ 编写清晰的注释和文档
3. ✅ 实现完善的错误处理
4. ✅ 进行充分的测试验证

### 开发完成后
1. ✅ 代码审查和优化
2. ✅ 性能测试和监控
3. ✅ 文档更新和维护
4. ✅ 部署和验证

### 持续改进
1. ✅ 收集用户反馈
2. ✅ 监控系统性能
3. ✅ 优化用户体验
4. ✅ 技术债务管理

---

## 🚀 记住这些原则

> **Context First**: 理解比编码更重要
> 
> **Step by Step**: 复杂问题简单化
> 
> **Task Breakdown**: 大任务小步骤
> 
> **Deep Thinking**: 思考先于行动
> 
> **Quality Focus**: 质量胜过速度
> 
> **User Centric**: 用户体验至上

**最终目标：写出让人（包括未来的自己）容易理解和维护的高质量代码！** 🎯 