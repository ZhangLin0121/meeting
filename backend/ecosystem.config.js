module.exports = {
  apps: [
    {
      name: 'meeting-backend',
      script: 'server.js',
      cwd: '/opt/meeting/backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
