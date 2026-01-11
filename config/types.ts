export interface Config {
  appName: string;
  ip: string;
  user: string;
  key: string;
  repo: string;
  branch: string;
  domain: string;
  nodeVersion: string;
  deploymentPath: string;
  envBackend: string;
  envFrontend: string;
}

export interface Connection {
  host: string;
  user: string;
  privateKey: string;
}
