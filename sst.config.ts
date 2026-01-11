/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "app-deployer",
      home: "local",
      providers: { command: "1.0.1" },
    };
  },
  async run() {
    // Dynamic imports as required by SST
    const command = await import("@pulumi/command");
    
    // Import configuration modules
    const { loadConfig } = await import("./config/load-config");
    const { createSystemSetupCommand } = await import("./config/system-setup");
    const { createSSLSetupCommand } = await import("./config/ssl-setup");
    const { createGitDeployCommand, createEnvUploadCommand } = await import("./config/git-deploy");
    const { createBackendBuildCommand, createFrontendBuildCommand } = await import("./config/build");
    const { createPM2ConfigCommand } = await import("./config/pm2-config");
    const { createApacheConfigCommand } = await import("./config/apache-config");
    const { createFinalSetupCommand } = await import("./config/final-setup");

    // Load configuration
    const config = await loadConfig();

    const connection = {
      host: config.ip,
      user: config.user,
      privateKey: config.key,
    };

    // --- 2. OS DETECTION & SYSTEM SETUP ---
    const systemSetup = new command.remote.Command(
      "SystemSetup",
      {
        connection,
        create: createSystemSetupCommand(config),
      },
      {
        deleteBeforeReplace: false,
      }
    );

    // --- 3. SSL CERTIFICATE SETUP ---
    const sslSetup = new command.remote.Command(
      "SSLSetup",
      {
        connection,
        create: createSSLSetupCommand(config),
      },
      {
        dependsOn: [systemSetup],
        deleteBeforeReplace: false,
      }
    );

    // --- 4. GIT REPOSITORY DEPLOYMENT ---
    const gitDeploy = new command.remote.Command(
      "GitDeploy",
      {
        connection,
        create: createGitDeployCommand(config),
      },
      {
        dependsOn: [systemSetup],
        deleteBeforeReplace: false,
      }
    );

    // --- 5. ENVIRONMENT VARIABLE UPLOAD ---
    const envUpload = new command.remote.Command(
      "EnvUpload",
      {
        connection,
        create: createEnvUploadCommand(config),
      },
      {
        dependsOn: [gitDeploy],
        deleteBeforeReplace: false,
      }
    );

    // --- 6. BACKEND BUILD ---
    const backendBuild = new command.remote.Command(
      "BackendBuild",
      {
        connection,
        create: createBackendBuildCommand(config),
      },
      {
        dependsOn: [envUpload],
        deleteBeforeReplace: false,
      }
    );

    // --- 7. FRONTEND BUILD ---
    const frontendBuild = new command.remote.Command(
      "FrontendBuild",
      {
        connection,
        create: createFrontendBuildCommand(config),
      },
      {
        dependsOn: [envUpload],
        deleteBeforeReplace: false,
      }
    );

    // --- 8. PM2 CONFIGURATION ---
    const pm2Config = new command.remote.Command(
      "PM2Config",
      {
        connection,
        create: createPM2ConfigCommand(config),
      },
      {
        dependsOn: [backendBuild, frontendBuild],
        deleteBeforeReplace: false,
      }
    );

    // --- 9. APACHE CONFIGURATION ---
    const apacheConfig = new command.remote.Command(
      "ApacheConfig",
      {
        connection,
        create: createApacheConfigCommand(config),
      },
      {
        dependsOn: [sslSetup, pm2Config],
        deleteBeforeReplace: false,
      }
    );

    // --- 10. FILE PERMISSIONS & FINAL SETUP ---
    const finalSetup = new command.remote.Command(
      "FinalSetup",
      {
        connection,
        create: createFinalSetupCommand(config),
      },
      {
        dependsOn: [apacheConfig],
        deleteBeforeReplace: false,
      }
    );

    return {
      status: "Deployment configured",
      appName: config.appName,
      domain: config.domain,
      deploymentPath: config.deploymentPath,
    };
  },
});
