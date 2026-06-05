export type BranchKey = string;

export type ConnectionString = string;

export interface Capabilities {
  readonly instantClone: boolean;
  readonly snapshot: boolean;
  readonly isolatedPerBranch: boolean;
}

export interface DatasourceAdapter {
  readonly id: string;
  readonly apiVersion: number;
  readonly capabilities: Capabilities;

  resolve(key: BranchKey): ConnectionString;

  exists(key: BranchKey): Promise<boolean>;
  list(): Promise<BranchKey[]>;

  create(key: BranchKey): Promise<void>;
  clone(from: BranchKey, to: BranchKey): Promise<void>;
  destroy(key: BranchKey): Promise<void>;
}

export interface MigratorAdapter {
  readonly id: string;
  readonly apiVersion: number;

  fingerprint(): Promise<string>;

  apply(connection: ConnectionString): Promise<void>;

  seed(connection: ConnectionString): Promise<void>;

  drift?(connection: ConnectionString): Promise<boolean>;
  status?(connection: ConnectionString): Promise<string>;
}

export interface ConnectionResolver {
  readonly id: string;
  readonly apiVersion: number;

  inject(connection: ConnectionString): Promise<void>;
}

export interface Vcs {
  readonly id: string;
  readonly apiVersion: number;

  currentRef(): Promise<string>;

  liveRefs?(): Promise<string[]>;

  mergedRefs?(): Promise<string[]>;

  stateDir?(): Promise<string>;
}
