import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let SQL: SqlJsStatic | null = null;

export class SqliteDatabaseClient {
  private db: Database | null = null;
  private dbFilePath: string;

  constructor(filePath?: string) {
    this.dbFilePath = filePath || path.resolve(process.cwd(), 'database', 'classguard.sqlite');
  }

  public async init(): Promise<void> {
    if (!SQL) {
      SQL = await initSqlJs();
    }

    const dir = path.dirname(this.dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.dbFilePath)) {
      const fileBuffer = fs.readFileSync(this.dbFilePath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
      this.save();
    }
  }

  public getRawDb(): Database {
    if (!this.db) {
      throw new Error('Database is not initialized. Call init() first.');
    }
    return this.db;
  }

  public save(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbFilePath, buffer);
  }

  public exec(sql: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.exec(sql);
    this.save();
  }

  public query<T = any>(sql: string, params: any[] = []): T[] {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as T);
      }
      return results;
    } finally {
      stmt.free();
    }
  }

  public queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const rows = this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  public run(sql: string, params: any[] = []): { changes: number } {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      stmt.step();
      const changes = this.db.getRowsModified();
      this.save();
      return { changes };
    } finally {
      stmt.free();
    }
  }

  public migrate(migrationsSqlPath?: string): void {
    let migrationFile = migrationsSqlPath;
    if (!migrationFile) {
      const candidates = [
        path.resolve(process.cwd(), 'database', 'migrations', '001_initial_schema.sql'),
        path.resolve(process.cwd(), '..', '..', 'database', 'migrations', '001_initial_schema.sql'),
        path.resolve(process.cwd(), '..', 'database', 'migrations', '001_initial_schema.sql'),
        path.resolve(__dirname, '../../../../database/migrations/001_initial_schema.sql'),
      ];
      migrationFile = candidates.find((c) => fs.existsSync(c));
    }
    if (migrationFile && fs.existsSync(migrationFile)) {
      const sql = fs.readFileSync(migrationFile, 'utf8');
      this.exec(sql);
    }

    // Ensure qr_credential column exists in students
    try {
      const studentCols = this.query<{ name: string }>('PRAGMA table_info(students)');
      if (studentCols.length > 0 && !studentCols.some((c) => c.name === 'qr_credential')) {
        this.run('ALTER TABLE students ADD COLUMN qr_credential TEXT');
      }
    } catch {}

    // Ensure attendance_records check constraint includes FACE_VERIFIED and QR_FALLBACK
    try {
      const recTableSql = this.queryOne<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='attendance_records'"
      );
      if (recTableSql && recTableSql.sql && !recTableSql.sql.includes('FACE_VERIFIED')) {
        this.exec(`
          CREATE TABLE IF NOT EXISTS attendance_records_new (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL REFERENCES students(id),
            matric_number TEXT NOT NULL,
            student_name TEXT NOT NULL,
            course_id TEXT NOT NULL REFERENCES courses(id),
            session_id TEXT NOT NULL REFERENCES attendance_sessions(id),
            timestamp TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('PRESENT', 'LATE', 'EXCUSED')),
            verification_method TEXT NOT NULL CHECK(verification_method IN ('FACE_VERIFIED', 'QR_FALLBACK', 'MANUAL_OVERRIDE', 'TEST_SIMULATION', 'QR_AND_FACE')),
            similarity_score REAL,
            liveness_passed INTEGER DEFAULT 1,
            kiosk_id TEXT,
            notes TEXT,
            sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'FAILED')),
            synced_at TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(student_id, session_id)
          );
          INSERT OR IGNORE INTO attendance_records_new SELECT * FROM attendance_records;
          DROP TABLE attendance_records;
          ALTER TABLE attendance_records_new RENAME TO attendance_records;
          CREATE INDEX IF NOT EXISTS idx_attendance_student_session ON attendance_records(student_id, session_id);
          CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance_records(session_id);
          CREATE INDEX IF NOT EXISTS idx_attendance_course ON attendance_records(course_id);
          CREATE INDEX IF NOT EXISTS idx_attendance_sync ON attendance_records(sync_status);
        `);
      }
    } catch {}
  }

  public close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}
