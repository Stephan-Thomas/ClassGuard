"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteDatabaseClient = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const sql_js_1 = __importDefault(require("sql.js"));
let SQL = null;
class SqliteDatabaseClient {
    db = null;
    dbFilePath;
    constructor(filePath) {
        this.dbFilePath = filePath || node_path_1.default.resolve(process.cwd(), 'database', 'classguard.sqlite');
    }
    async init() {
        if (!SQL) {
            SQL = await (0, sql_js_1.default)();
        }
        const dir = node_path_1.default.dirname(this.dbFilePath);
        if (!node_fs_1.default.existsSync(dir)) {
            node_fs_1.default.mkdirSync(dir, { recursive: true });
        }
        if (node_fs_1.default.existsSync(this.dbFilePath)) {
            const fileBuffer = node_fs_1.default.readFileSync(this.dbFilePath);
            this.db = new SQL.Database(fileBuffer);
        }
        else {
            this.db = new SQL.Database();
            this.save();
        }
    }
    getRawDb() {
        if (!this.db) {
            throw new Error('Database is not initialized. Call init() first.');
        }
        return this.db;
    }
    save() {
        if (!this.db)
            return;
        const data = this.db.export();
        const buffer = Buffer.from(data);
        node_fs_1.default.writeFileSync(this.dbFilePath, buffer);
    }
    exec(sql) {
        if (!this.db)
            throw new Error('Database not initialized');
        this.db.exec(sql);
        this.save();
    }
    query(sql, params = []) {
        if (!this.db)
            throw new Error('Database not initialized');
        const stmt = this.db.prepare(sql);
        try {
            stmt.bind(params);
            const results = [];
            while (stmt.step()) {
                results.push(stmt.getAsObject());
            }
            return results;
        }
        finally {
            stmt.free();
        }
    }
    queryOne(sql, params = []) {
        const rows = this.query(sql, params);
        return rows.length > 0 ? rows[0] : null;
    }
    run(sql, params = []) {
        if (!this.db)
            throw new Error('Database not initialized');
        const stmt = this.db.prepare(sql);
        try {
            stmt.bind(params);
            stmt.step();
            const changes = this.db.getRowsModified();
            this.save();
            return { changes };
        }
        finally {
            stmt.free();
        }
    }
    migrate(migrationsSqlPath) {
        const migrationFile = migrationsSqlPath || node_path_1.default.resolve(process.cwd(), 'database', 'migrations', '001_initial_schema.sql');
        if (node_fs_1.default.existsSync(migrationFile)) {
            const sql = node_fs_1.default.readFileSync(migrationFile, 'utf8');
            this.exec(sql);
        }
    }
    close() {
        if (this.db) {
            this.save();
            this.db.close();
            this.db = null;
        }
    }
}
exports.SqliteDatabaseClient = SqliteDatabaseClient;
