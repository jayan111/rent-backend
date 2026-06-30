/**
 * Script to export all data from the database to SQL file
 * Run: node exportDatabase.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function exportDatabase() {
  let connection;
  
  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'rentyourneeds',
      port: parseInt(process.env.DB_PORT || '3306'),
    });

    console.log('Connected to database. Exporting data...\n');

    // Get all tables
    const [tables] = await connection.execute('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);

    let sql = `-- RentYourNeeds Database Export
-- Generated on: ${new Date().toISOString()}
-- Database: ${process.env.DB_NAME || 'rentyourneeds'}

SET FOREIGN_KEY_CHECKS=0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

`;

    for (const tableName of tableNames) {
      console.log(`Exporting table: ${tableName}`);
      
      // Get table structure
      const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
      
      // Get all data
      const [rows] = await connection.execute(`SELECT * FROM ${tableName}`);
      
      if (rows.length > 0) {
        sql += `\n-- ============================================\n`;
        sql += `-- TABLE: ${tableName}\n`;
        sql += `-- Records: ${rows.length}\n`;
        sql += `-- ============================================\n\n`;
        
        const columnNames = columns.map(c => c.Field);
        const escapedColumns = columnNames.map(c => `\`${c}\``).join(', ');
        
        for (const row of rows) {
          const values = columnNames.map(col => {
            const value = row[col];
            if (value === null) return 'NULL';
            if (typeof value === 'number') return value;
            if (typeof value === 'boolean') return value ? 1 : 0;
            
            // Handle dates
            if (value instanceof Date) {
              return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
            }
            
            // Escape string
            return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"')}'`;
          });
          
          sql += `INSERT INTO \`${tableName}\` (${escapedColumns}) VALUES (${values.join(', ')});\n`;
        }
        sql += '\n';
      }
    }

    sql += `\nSET FOREIGN_KEY_CHECKS=1;\nCOMMIT;\n`;

    // Write to file
    const fs = require('fs');
    const filename = `database_export_${Date.now()}.sql`;
    fs.writeFileSync(filename, sql);
    
    console.log(`\n✓ Exported ${tableNames.length} tables to: ${filename}`);
    console.log(`✓ Total file size: ${(fs.statSync(filename).size / 1024).toFixed(2)} KB`);
    
    await connection.end();
    process.exit(0);
    
  } catch (error) {
    console.error('Error exporting database:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

exportDatabase();

