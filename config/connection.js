'use strict';

const { Sequelize } = require('sequelize');
const { Client } = require('pg');
const dbConfig = require('./database');
const env = process.env.NODE_ENV || 'development';
const config = dbConfig[env];

(async () => {
  try {
    // Connect to default "postgres" DB to create target DB if missing
    const client = new Client({
      host: config.host,
      user: config.username,
      password: config.password,
      port: config.port,
      database: 'postgres',
    });
    await client.connect();

    const checkDb = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${config.database}'`);
    if (checkDb.rowCount === 0) {
      await client.query(`CREATE DATABASE ${config.database}`);
      console.log(`✅ Database '${config.database}' created successfully on host ${config.host}.`);
    } else {
      console.log(`ℹ️ Database '${config.database}' already exists.`);
    }

    await client.end();

    // Connect with Sequelize now
    const sequelize = new Sequelize(
      config.database,
      config.username,
      config.password,
      {
        host: config.host,
        dialect: config.dialect,
        port: config.port,
        logging: false,
      }
    );

    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (error) {
    console.error('❌ Error creating or connecting to database:', error.message);
  }
})();
