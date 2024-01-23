interface Config {
  port: number;
  dbUrl: string;
  dbUser: string;
  dbPass: string;
  dbAuthSource: string;
  jwtSecret: string;
  origin: string | string[];
}

const devConfig: Config = {
  port: 30101,
  dbUrl: 'mongodb://server.cqupt-gyr.xyz/GKerLove',
  dbUser: process.env.GKerLove_DB_username || '',
  dbPass: process.env.GKerLove_DB_password || '',
  dbAuthSource: process.env.GKerLove_DB_authsource || '',
  jwtSecret: process.env.GKerLove_JWT_secret || '',
  origin: '*',
};

const prodConfig: Config = {
  port: 8080,
  dbUrl: 'mongodb://mongodb/GKerLove',
  dbUser: 'gkers',
  dbPass: 'gkers111666',
  dbAuthSource: 'admin',
  jwtSecret: process.env.GKerLove_JWT_secret || '',
  origin: ['https://love.gkers.cqupt-gyr.xyz', 'https://love.gkers.top'],
};

const config = process.env.NODE_ENV === 'prod' ? prodConfig : devConfig;

export default config;
