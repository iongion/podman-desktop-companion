// nodejs
const fs = require("fs");
const path = require("path");
// vendors
const merge = require("lodash.merge");
// project
const { isFlatpak } = require("@podman-desktop-companion/utils");
const userSettings = require("@podman-desktop-companion/user-settings");
const { getAvailablePodmanMachines } = require("@podman-desktop-companion/detector");
// module
const {
  // WSL - common
  WSL_PROGRAM,
  WSL_PATH,
  WSL_VERSION,
  WSL_DISTRIBUTION,
  // LIMA - common
  LIMA_PROGRAM,
  LIMA_PATH,
  LIMA_VERSION
} = require("../constants");
const {
  AbstractAdapter,
  AbstractClientEngine,
  AbstractControlledClientEngine,
  AbstractClientEngineSubsystemWSL,
  AbstractClientEngineSubsystemLIMA
} = require("./abstract");
// locals
const PROGRAM = "podman";
const API_BASE_URL = "http://d/v3.0.0/libpod";
const PODMAN_MACHINE_DEFAULT = "podman-machine-default";
const PODMAN_API_SOCKET = `podman-desktop-companion-${PROGRAM}-rest-api.sock`;
// Native
const NATIVE_PODMAN_CLI_PATH = "/usr/bin/podman";
const NATIVE_PODMAN_CLI_VERSION = "4.0.3";
const NATIVE_PODMAN_SOCKET_PATH = isFlatpak()
  ? path.join("/tmp", PODMAN_API_SOCKET)
  : path.join(userSettings.getPath(), PODMAN_API_SOCKET);
const NATIVE_PODMAN_MACHINE_CLI_VERSION = "4.0.3";
const NATIVE_PODMAN_MACHINE_CLI_PATH = "/usr/bin/podman";
// Windows virtualized
const WINDOWS_PODMAN_NATIVE_CLI_VERSION = "4.0.3-dev";
const WINDOWS_PODMAN_NATIVE_CLI_PATH = "C:\\Program Files\\RedHat\\Podman\\podman.exe";
const WINDOWS_PODMAN_MACHINE_CLI_VERSION = "4.0.3";
const WINDOWS_PODMAN_MACHINE_CLI_PATH = "/usr/bin/podman";
// MacOS virtualized
const MACOS_PODMAN_NATIVE_CLI_VERSION = "4.0.3";
const MACOS_PODMAN_NATIVE_CLI_PATH = "/usr/local/bin/podman";
const MACOS_PODMAN_MACHINE_CLI_VERSION = "4.0.2";
const MACOS_PODMAN_MACHINE_CLI_PATH = "/usr/bin/podman";
// Windows WSL
const WSL_PODMAN_CLI_PATH = "/usr/bin/podman";
const WSL_PODMAN_CLI_VERSION = "3.4.2";
// MacOS LIMA
const LIMA_PODMAN_CLI_PATH = "/usr/bin/podman";
const LIMA_PODMAN_CLI_VERSION = "3.2.1";
const LIMA_PODMAN_INSTANCE = "podman";
// Engines
const ENGINE_PODMAN_NATIVE = `${PROGRAM}.native`;
const ENGINE_PODMAN_VIRTUALIZED = `${PROGRAM}.virtualized`;
const ENGINE_PODMAN_SUBSYSTEM_WSL = `${PROGRAM}.subsystem.wsl`;
const ENGINE_PODMAN_SUBSYSTEM_LIMA = `${PROGRAM}.subsystem.lima`;

class PodmanClientEngineNative extends AbstractClientEngine {
  static ENGINE = ENGINE_PODMAN_NATIVE;
  ENGINE = ENGINE_PODMAN_NATIVE;
  PROGRAM = PROGRAM;

  static create(id, userConfiguration, osType) {
    const instance = new PodmanClientEngineNative(userConfiguration, osType);
    instance.id = `engine.${id}.${instance.ENGINE}`;
    instance.ADAPTER = PROGRAM;
    instance.setup();
    return instance;
  }

  // Settings
  async getExpectedSettings() {
    return {
      api: {
        baseURL: API_BASE_URL,
        connectionString: NATIVE_PODMAN_SOCKET_PATH
      },
      program: {
        name: PROGRAM,
        path: NATIVE_PODMAN_CLI_PATH,
        version: NATIVE_PODMAN_CLI_VERSION
      }
    };
  }
  async getUserSettings() {
    return {
      api: {
        baseURL: this.userConfiguration.getKey(`${this.id}.api.baseURL`),
        connectionString: this.userConfiguration.getKey(`${this.id}.api.connectionString`)
      },
      program: {
        path: this.userConfiguration.getKey(`${this.id}.program.path`)
      }
    };
  }
  // Runtime
  async startApi(customSettings, opts) {
    const running = await this.isApiRunning();
    if (running.success) {
      this.logger.debug(this.id, "API is already running");
      return true;
    }
    const settings = customSettings || (await this.getCurrentSettings());
    const started = await this.runner.startApi(opts, {
      path: settings.program.path,
      args: ["system", "service", "--time=0", `unix://${settings.api.connectionString}`, "--log-level=debug"]
    });
    this.apiStarted = started;
    this.logger.debug("Start API complete", started);
    return started;
  }
  // Availability
  async isEngineAvailable() {
    const result = { success: true, details: "Engine is available" };
    if (this.osType !== "Linux") {
      result.success = false;
      result.details = `Engine is not available on ${this.osType}`;
    }
    return result;
  }

  async getControllerScopes(customFormat) {
    return await this.getMachines(customFormat);
  }

  async getMachines(customFormat) {
    const settings = await this.getCurrentSettings();
    const availableEngine = await this.isEngineAvailable();
    const availableProgram = await this.isProgramAvailable(settings);
    const canListScopes = availableEngine.success && availableProgram.success && settings.program.path;
    const items = canListScopes ? await getAvailablePodmanMachines(settings.program.path, customFormat) : [];
    return items;
  }
}

class PodmanClientEngineVirtualized extends AbstractControlledClientEngine {
  static ENGINE = ENGINE_PODMAN_VIRTUALIZED;
  ENGINE = ENGINE_PODMAN_VIRTUALIZED;
  PROGRAM = PROGRAM;

  static create(id, userConfiguration, osType) {
    const instance = new PodmanClientEngineVirtualized(userConfiguration, osType);
    instance.id = `engine.${id}.${instance.ENGINE}`;
    instance.ADAPTER = PROGRAM;
    instance.setup();
    return instance;
  }

  // Helpers
  async getConnectionString(scope) {
    let connectionString = NATIVE_PODMAN_SOCKET_PATH;
    if (this.osType === "Windows_NT") {
      connectionString = `//./pipe/${scope}`;
    } else {
      connectionString = path.join(process.env.HOME, ".local/share/containers/podman/machine/", scope, "podman.sock");
    }
    return connectionString;
  }
  // Settings
  async getExpectedSettings() {
    const connectionString = await this.getConnectionString(PODMAN_MACHINE_DEFAULT);
    const defaults = {
      api: {
        baseURL: API_BASE_URL,
        connectionString: connectionString
      },
      controller: {
        name: PROGRAM,
        path: undefined,
        version: undefined,
        scope: undefined
      },
      program: {
        name: PROGRAM,
        path: undefined,
        version: undefined
      }
    };
    let config = {};
    if (this.osType === "Linux") {
      config = {
        controller: {
          name: PROGRAM,
          path: NATIVE_PODMAN_CLI_PATH,
          version: NATIVE_PODMAN_CLI_VERSION,
          scope: PODMAN_MACHINE_DEFAULT
        },
        program: {
          path: NATIVE_PODMAN_MACHINE_CLI_PATH,
          version: NATIVE_PODMAN_MACHINE_CLI_VERSION
        }
      };
    } else if (this.osType === "Windows_NT") {
      config = {
        controller: {
          name: PROGRAM,
          path: WINDOWS_PODMAN_NATIVE_CLI_PATH,
          version: WINDOWS_PODMAN_NATIVE_CLI_VERSION,
          scope: PODMAN_MACHINE_DEFAULT
        },
        program: {
          path: WINDOWS_PODMAN_MACHINE_CLI_PATH,
          version: WINDOWS_PODMAN_MACHINE_CLI_VERSION
        }
      };
    } else if (this.osType === "Darwin") {
      config = {
        controller: {
          name: PROGRAM,
          path: MACOS_PODMAN_NATIVE_CLI_PATH,
          version: MACOS_PODMAN_NATIVE_CLI_VERSION,
          scope: PODMAN_MACHINE_DEFAULT
        },
        program: {
          path: MACOS_PODMAN_MACHINE_CLI_PATH,
          version: MACOS_PODMAN_MACHINE_CLI_VERSION
        }
      };
    }
    const expected = merge({}, defaults, {
      api: {
        baseURL: API_BASE_URL,
        connectionString: connectionString
      },
      ...config
    });
    return expected;
  }
  async getControllerScopes() {
    return await this.getMachines();
  }
  async getMachines(customFormat) {
    this.logger.debug(this.id, "getMachines with controller");
    const settings = await this.getCurrentSettings();
    const availableEngine = await this.isEngineAvailable();
    const availableController = await this.isControllerAvailable(settings);
    const canListScopes = availableEngine.success && availableController.success && settings.controller.path;
    const items = canListScopes ? await getAvailablePodmanMachines(settings.controller.path, customFormat) : [];
    return items;
  }
  // Runtime
  async startApi(customSettings, opts) {
    const running = await this.isApiRunning();
    if (running.success) {
      this.logger.debug(this.id, "API is already running");
      return true;
    }
    const settings = customSettings || (await this.getCurrentSettings());
    // TODO: Safe to stop first before starting ?
    const started = await this.runner.startApi(opts, {
      path: settings.controller.path,
      args: ["machine", "start", settings.controller.scope]
    });
    this.apiStarted = started;
    this.logger.debug("Start API complete", started);
    return started;
  }
  async stopApi(customSettings, opts) {
    if (!this.apiStarted) {
      this.logger.debug("Stopping API - skip(not started here)");
      return false;
    }
    this.logger.debug("Stopping API - begin");
    const settings = await this.getCurrentSettings();
    return await this.runner.stopApi(opts, {
      path: settings.controller.path,
      args: ["machine", "stop", settings.controller.scope]
    });
  }
  // Availability
  async isEngineAvailable() {
    const result = { success: true, details: "Engine is available" };
    return result;
  }
  async isControllerScopeAvailable(settings) {
    const result = { success: false, details: "Scope is not available" };
    if (settings?.controller?.scope) {
      const instances = await this.getControllerScopes();
      const target = instances.find((it) => it.Name === settings.controller.scope && !!target?.Running);
      if (!!target) {
        result.success = true;
        result.details = "Scope is available";
      }
    }
    return result;
  }
  // Executes command inside controller scope
  async getScopedCommand(program, args, opts) {
    const { controller } = await this.getCurrentSettings();
    const command = ["machine", "ssh", opts?.scope || controller.scope, "-o", "LogLevel=ERROR"];
    if (program) {
      command.push(program);
    }
    if (args) {
      command.push(...args);
    }
    return { launcher: controller.path, command };
  }
}

class PodmanClientEngineSubsystemWSL extends AbstractClientEngineSubsystemWSL {
  static ENGINE = ENGINE_PODMAN_SUBSYSTEM_WSL;
  ENGINE = ENGINE_PODMAN_SUBSYSTEM_WSL;
  PROGRAM = PROGRAM;

  static create(id, userConfiguration, osType) {
    const instance = new PodmanClientEngineSubsystemWSL(userConfiguration, osType);
    instance.id = `engine.${id}.${instance.ENGINE}`;
    instance.ADAPTER = PROGRAM;
    instance.setup();
    return instance;
  }

  // Settings
  async getExpectedSettings() {
    return {
      api: {
        baseURL: API_BASE_URL,
        connectionString: `/tmp/${PODMAN_API_SOCKET}`
      },
      controller: {
        name: WSL_PROGRAM,
        path: WSL_PATH,
        version: WSL_VERSION,
        scope: WSL_DISTRIBUTION
      },
      program: {
        name: PROGRAM,
        path: WSL_PODMAN_CLI_PATH,
        version: WSL_PODMAN_CLI_VERSION
      }
    };
  }

  async getMachines(customFormat) {
    this.logger.debug(this.id, "getMachines with controller");
    const settings = await this.getCurrentSettings();
    const availableEngine = await this.isEngineAvailable();
    const availableController = await this.isControllerAvailable(settings);
    const canListScopes =
      availableEngine.success && availableController.success && settings.controller.path && settings.program.path;
    let items = [];
    if (canListScopes) {
      const command = await this.getScopedCommand();
      items = await getAvailablePodmanMachines(settings.program.path, customFormat, {
        wrapper: {
          launcher: command.launcher,
          args: command.command
        }
      });
    }
    return items;
  }

  // Runtime
  async startApi(customSettings, opts) {
    const running = await this.isApiRunning();
    if (running.success) {
      this.logger.debug("API is already running");
      return true;
    }
    const settings = customSettings || (await this.getCurrentSettings());
    const args = ["system", "service", "--time=0", `unix://${settings.api.connectionString}`, "--log-level=debug"];
    const { launcher, command } = await this.getScopedCommand(settings.program.path, args);
    const started = await this.runner.startApi(opts, {
      path: launcher,
      args: command
    });
    this.apiStarted = started;
    this.logger.debug("Start API complete", started);
    return started;
  }
}

class PodmanClientEngineSubsystemLIMA extends AbstractClientEngineSubsystemLIMA {
  static ENGINE = ENGINE_PODMAN_SUBSYSTEM_LIMA;
  ENGINE = ENGINE_PODMAN_SUBSYSTEM_LIMA;
  PROGRAM = PROGRAM;

  static create(id, userConfiguration, osType) {
    const instance = new PodmanClientEngineSubsystemLIMA(userConfiguration, osType);
    instance.id = `engine.${id}.${instance.ENGINE}`;
    instance.ADAPTER = PROGRAM;
    instance.setup();
    return instance;
  }

  // Settings
  async getExpectedSettings() {
    return {
      api: {
        baseURL: API_BASE_URL,
        connectionString: await this.getConnectionString(LIMA_PODMAN_INSTANCE)
      },
      controller: {
        name: LIMA_PROGRAM,
        path: LIMA_PATH,
        version: LIMA_VERSION,
        scope: LIMA_PODMAN_INSTANCE
      },
      program: {
        name: PROGRAM,
        path: LIMA_PODMAN_CLI_PATH,
        version: LIMA_PODMAN_CLI_VERSION
      }
    };
  }

  async getMachines(customFormat) {
    this.logger.debug(this.id, "getMachines with controller");
    const settings = await this.getCurrentSettings();
    const availableEngine = await this.isEngineAvailable();
    const availableController = await this.isControllerAvailable(settings);
    const canListScopes =
      availableEngine.success && availableController.success && settings.controller.path && settings.program.path;
    let items = [];
    if (canListScopes) {
      const command = await this.getScopedCommand();
      items = await getAvailablePodmanMachines(settings.program.path, customFormat, {
        wrapper: {
          launcher: command.launcher,
          args: command.command
        }
      });
    }
    return items;
  }
}

class Adapter extends AbstractAdapter {
  static ADAPTER = PROGRAM;
  ADAPTER = PROGRAM;
  ENGINES = [
    PodmanClientEngineNative,
    PodmanClientEngineVirtualized,
    PodmanClientEngineSubsystemWSL,
    PodmanClientEngineSubsystemLIMA
  ];

  static create(userConfiguration, osType) {
    const instance = new Adapter(userConfiguration, osType);
    instance.setup();
    return instance;
  }
}

module.exports = {
  // adapters
  Adapter,
  // engines
  PodmanClientEngineNative,
  PodmanClientEngineVirtualized,
  PodmanClientEngineSubsystemWSL,
  PodmanClientEngineSubsystemLIMA,
  // constants
  PROGRAM,
  ENGINE_PODMAN_NATIVE,
  ENGINE_PODMAN_VIRTUALIZED,
  ENGINE_PODMAN_SUBSYSTEM_WSL,
  ENGINE_PODMAN_SUBSYSTEM_LIMA
};
