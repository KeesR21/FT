// PM2 process file — used on Hostinger VPS
// Start: pm2 start ecosystem.config.js
// Reload: pm2 reload ftpr-lions --update-env

module.exports = {
  apps: [
    {
      name: "ftpr-lions",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/var/www/ftpr-lions",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      error_file: "/var/log/ftpr-lions/err.log",
      out_file: "/var/log/ftpr-lions/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    }
  ]
};
