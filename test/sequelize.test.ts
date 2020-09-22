import { Sequelize, QueryInterface } from 'sequelize';
import { SequelizeStorage } from '../src';
import { Umzug } from '../src/umzug';
import { fsSyncer } from 'fs-syncer';
import * as path from 'path';

describe('v2 back compat', () => {
	const baseDir = path.join(__dirname, 'generated/sequelize/integration/back-compat');

	const syncer = fsSyncer(path.join(baseDir, 'migrations'), {
		'00_initial.js': `
			const { DataTypes } = require('sequelize');

			async function up(queryInterface) {
				await queryInterface.createTable('users', {
					id: {
						type: DataTypes.INTEGER,
						allowNull: false,
						primaryKey: true
					},
					name: {
						type: DataTypes.STRING,
						allowNull: false
					}
				});
			}
			
			async function down(queryInterface) {
				await queryInterface.dropTable('users');
			}
			
			module.exports = { up, down };
		`,
	});

	const sequelize = new Sequelize({
		dialect: 'sqlite',
		storage: path.join(baseDir, 'db.sqlite'),
		logging: false,
	});

	beforeAll(async () => {
		syncer.sync();
		await sequelize.query('drop table if exists users');
	});

	test('sequelize integration test', async () => {
		const context = sequelize.getQueryInterface();
		const umzug = new Umzug({
			migrations: {
				glob: ['migrations/*.js', { cwd: baseDir }],
				resolve: ({ name, path, context }) => {
					// umzug v2.x received context directly - this resolve function supports migrations written for v2
					type MigrationFnV2 = (queryInterface: QueryInterface) => Promise<unknown>;
					// eslint-disable-next-line @typescript-eslint/no-var-requires
					const migration: { up: MigrationFnV2; down: MigrationFnV2 } = require(path);

					return { name, up: async () => migration.up(context), down: async () => migration.down(context) };
				},
			},
			context,
			storage: new SequelizeStorage({ sequelize }),
			logging: false,
		});

		const tableCount = () => {
			const sql = `
        SELECT count(*) as count
        FROM sqlite_master
        WHERE type='table'
        AND name='users'
      `;
			return context.sequelize.query(sql).then(([results]) => results[0]);
		};

		expect(await tableCount()).toEqual({ count: 0 });

		await umzug.up();

		expect(await tableCount()).toEqual({ count: 1 });

		await umzug.down();

		expect(await tableCount()).toEqual({ count: 0 });
	});
});

describe('recommended usage', () => {
	const baseDir = path.join(__dirname, 'generated/sequelize/integration/recommended-usage');

	const syncer = fsSyncer(path.join(baseDir, 'migrations'), {
		'00_initial.js': `
			const { DataTypes } = require('sequelize');

			async function up({context: queryInterface}) {
				await queryInterface.createTable('users', {
					id: {
						type: DataTypes.INTEGER,
						allowNull: false,
						primaryKey: true
					},
					name: {
						type: DataTypes.STRING,
						allowNull: false
					}
				});
			}
			
			async function down({context: queryInterface}) {
				await queryInterface.dropTable('users');
			}
			
			module.exports = { up, down };
		`,
	});

	const sequelize = new Sequelize({
		dialect: 'sqlite',
		storage: path.join(baseDir, 'db.sqlite'),
		logging: false,
	});

	beforeAll(async () => {
		syncer.sync();
		await sequelize.query('drop table if exists users');
	});

	test('sequelize recommended usage integration test', async () => {
		const context = sequelize.getQueryInterface();
		const umzug = new Umzug({
			migrations: {
				glob: ['migrations/*.js', { cwd: baseDir }],
			},
			context,
			storage: new SequelizeStorage({ sequelize }),
			logging: false,
		});

		const tableCount = () => {
			const sql = `
        SELECT count(*) as count
        FROM sqlite_master
        WHERE type='table'
        AND name='users'
      `;
			return context.sequelize.query(sql).then(([results]) => results[0]);
		};

		expect(await tableCount()).toEqual({ count: 0 });

		await umzug.up();

		expect(await tableCount()).toEqual({ count: 1 });

		await umzug.down();

		expect(await tableCount()).toEqual({ count: 0 });
	});
});