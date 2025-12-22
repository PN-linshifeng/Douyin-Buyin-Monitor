#!/bin/bash

# 配置
HOST="Lin_8.148.4.165"
# USER="root" # 在 ~/.ssh/config 中配置
REMOTE_PATH="/www/wwwroot"
remote_project_name="buyin_monitor_backend" 
LOCAL_DIST_PATH="dist/buyin_monitor_backend"
BACKUP_PATH="/www/backup"
DATE=$(date +%Y%m%d_%H%M%S)

echo "开始部署到 $HOST..."

# 1. 构建
echo "正在构建项目..."
npm run build
if [ $? -ne 0 ]; then
    echo "构建失败。终止部署。"
    exit 1
fi

# 2. 远程备份
echo "正在创建远程备份..."
ssh $HOST "mkdir -p $BACKUP_PATH && \
    if [ -d $REMOTE_PATH/$remote_project_name ]; then \
        tar --exclude='node_modules' -czf $BACKUP_PATH/$remote_project_name\_$DATE.tar.gz -C $REMOTE_PATH $remote_project_name; \
    fi"

if [ $? -eq 0 ]; then
    echo "备份创建成功: $BACKUP_PATH/$remote_project_name\_$DATE.tar.gz"
else
    echo "备份失败。终止部署。"
    exit 1
fi

# 3. 上传 (使用 tar + scp 以避免远程缺少 rsync 的依赖)
echo "正在打包并上传文件..."

# 在本地创建一个临时压缩包
TAR_NAME="deploy_package_$DATE.tar.gz"
tar --exclude='database' \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='.env' \
    --exclude='.DS_Store' \
    --exclude='*.log' \
    --exclude='*.md' \
    -czf $TAR_NAME -C $LOCAL_DIST_PATH .

if [ $? -ne 0 ]; then
    echo "创建本地压缩包失败。"
    exit 1
fi

# 上传压缩包
scp $TAR_NAME $HOST:$REMOTE_PATH/

if [ $? -ne 0 ]; then
    echo "SCP 上传失败。终止部署。"
    rm $TAR_NAME
    exit 1
fi

# 清理本地压缩包
rm $TAR_NAME

# 在远程解压
echo "正在远程解压文件..."
ssh $HOST "mkdir -p $REMOTE_PATH/$remote_project_name && \
    tar -xzf $REMOTE_PATH/$TAR_NAME -C $REMOTE_PATH/$remote_project_name && \
    rm $REMOTE_PATH/$TAR_NAME"

if [ $? -eq 0 ]; then
    echo "上传并解压成功。"
else
    echo "解压失败。终止部署。"
    exit 1
fi

# 4. 重启
echo "正在重启应用..."
ssh $HOST "cd $REMOTE_PATH/$remote_project_name && \
    npm install --production && \
    pm2 restart buyin-backend"

if [ $? -eq 0 ]; then
    echo "部署成功！"
else
    echo "重启失败。"
    exit 1
fi
