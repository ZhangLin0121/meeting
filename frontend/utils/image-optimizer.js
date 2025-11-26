/**
 * 图片优化工具
 * 压缩图片、缓存管理、减少内存占用
 */

class ImageOptimizer {
    constructor() {
        this.imageCache = new Map();
        this.maxCacheSize = 20; // 最多缓存20张图片
        this.compressionQuality = 0.8; // 压缩质量
        this.maxWidth = 800; // 最大宽度
        this.maxHeight = 600; // 最大高度
    }

    /**
     * 压缩图片
     */
    compressImage(src, options = {}) {
        return new Promise((resolve, reject) => {
            const {
                quality = this.compressionQuality,
                    maxWidth = this.maxWidth,
                    maxHeight = this.maxHeight
            } = options;

            // 检查缓存
            const cacheKey = `${src}_${quality}_${maxWidth}_${maxHeight}`;
            if (this.imageCache.has(cacheKey)) {
                resolve(this.imageCache.get(cacheKey));
                return;
            }

            wx.getImageInfo({
                src: src,
                success: (res) => {
                    // 计算新尺寸
                    const { width, height } = this.calculateNewSize(res.width, res.height, maxWidth, maxHeight);

                    // 如果不需要压缩，直接返回
                    if (width === res.width && height === res.height && quality >= 0.9) {
                        this.cacheImage(cacheKey, res.path);
                        resolve(res.path);
                        return;
                    }

                    // 创建canvas进行压缩
                    this.compressWithCanvas(res.path, width, height, quality)
                        .then(compressedPath => {
                            this.cacheImage(cacheKey, compressedPath);
                            resolve(compressedPath);
                        })
                        .catch(reject);
                },
                fail: reject
            });
        });
    }

    /**
     * 计算新尺寸
     */
    calculateNewSize(originalWidth, originalHeight, maxWidth, maxHeight) {
        let { width, height } = { width: originalWidth, height: originalHeight };

        // 按比例缩放
        if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
        }

        if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
        }

        return {
            width: Math.round(width),
            height: Math.round(height)
        };
    }

    /**
     * 使用Canvas压缩图片
     */
    compressWithCanvas(imagePath, width, height, quality) {
        return new Promise((resolve, reject) => {
            try {
                const canvas = wx.createOffscreenCanvas({
                    type: '2d',
                    width: width,
                    height: height
                });

                const ctx = canvas.getContext('2d');
                const img = canvas.createImage();

                img.onload = () => {
                    ctx.drawImage(img, 0, 0, width, height);

                    wx.canvasToTempFilePath({
                        canvas: canvas,
                        quality: quality,
                        fileType: 'jpg',
                        success: (res) => {
                            resolve(res.tempFilePath);
                        },
                        fail: reject
                    });
                };

                img.onerror = reject;
                img.src = imagePath;
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 缓存图片
     */
    cacheImage(key, path) {
        // 如果缓存已满，删除最旧的
        if (this.imageCache.size >= this.maxCacheSize) {
            const firstKey = this.imageCache.keys().next().value;
            this.imageCache.delete(firstKey);
        }

        this.imageCache.set(key, {
            path: path,
            timestamp: Date.now()
        });
    }

    /**
     * 预加载图片（带压缩）
     */
    async preloadImage(src, options = {}) {
        try {
            return await this.compressImage(src, options);
        } catch (error) {
            console.error('预加载图片失败:', error);
            return src; // 返回原始地址作为备选
        }
    }

    /**
     * 批量预加载图片
     */
    async preloadImages(srcList, options = {}) {
        const promises = srcList.map(src => this.preloadImage(src, options));

        try {
            return await Promise.all(promises);
        } catch (error) {
            console.error('批量预加载失败:', error);
            return srcList; // 返回原始列表作为备选
        }
    }

    /**
     * 清理缓存
     */
    clearCache() {
        this.imageCache.clear();
    }

    /**
     * 清理过期缓存
     */
    cleanExpiredCache(maxAge = 30 * 60 * 1000) { // 默认30分钟
        const now = Date.now();
        for (const [key, cached] of this.imageCache.entries()) {
            if (now - cached.timestamp > maxAge) {
                this.imageCache.delete(key);
            }
        }
    }

    /**
     * 获取缓存统计
     */
    getCacheStats() {
        return {
            size: this.imageCache.size,
            maxSize: this.maxCacheSize,
            keys: Array.from(this.imageCache.keys())
        };
    }

    /**
     * 智能图片加载
     * 根据网络状况调整压缩参数
     */
    smartLoadImage(src, options = {}) {
        return new Promise((resolve, reject) => {
            wx.getNetworkType({
                success: (res) => {
                    let compressionOptions = {...options };

                    // 根据网络类型调整压缩策略
                    switch (res.networkType) {
                        case '2g':
                            compressionOptions.quality = 0.5;
                            compressionOptions.maxWidth = 400;
                            compressionOptions.maxHeight = 300;
                            break;
                        case '3g':
                            compressionOptions.quality = 0.6;
                            compressionOptions.maxWidth = 600;
                            compressionOptions.maxHeight = 450;
                            break;
                        case '4g':
                        case '5g':
                        case 'wifi':
                            compressionOptions.quality = 0.8;
                            compressionOptions.maxWidth = 800;
                            compressionOptions.maxHeight = 600;
                            break;
                        default:
                            compressionOptions.quality = 0.7;
                            compressionOptions.maxWidth = 600;
                            compressionOptions.maxHeight = 450;
                    }

                    this.compressImage(src, compressionOptions)
                        .then(resolve)
                        .catch(reject);
                },
                fail: () => {
                    // 网络检测失败，使用默认压缩
                    this.compressImage(src, options)
                        .then(resolve)
                        .catch(reject);
                }
            });
        });
    }
}

// 创建全局实例
const imageOptimizer = new ImageOptimizer();

module.exports = imageOptimizer;