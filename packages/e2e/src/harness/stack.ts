export interface AdminDatabase {
  databaseExists(name: string): Promise<boolean>;
  dropDatabase(name: string): Promise<void>;
  dropTestDatabases(): Promise<void>;
}

export type WidgetProbe = Pick<E2eStack, 'countWidgets' | 'hasColorColumn'>;

export interface E2eStack {
  readonly label: string;
  readonly prefix: string;
  readonly dependencies: readonly string[];
  readonly admin: AdminDatabase;
  writeProjectFiles(fixture: string): Promise<void>;
  addColorMigration(fixture: string): Promise<void>;
  countWidgets(connection: string): Promise<number>;
  hasColorColumn(connection: string): Promise<boolean>;
}
