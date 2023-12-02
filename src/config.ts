interface Config {
  port: number;
  dbUrl: string;
  dbUser: string;
  dbPass: string;
  dbAuthSource: string;
  jwtSecret: string;
  origin: string;
}

const devConfig: Config = {
  port: 3000,
  dbUrl: 'mongodb://server.cqupt-gyr.xyz/GKerLove',
  dbUser: 'gkers',
  dbPass: 'gkers111666',
  dbAuthSource: 'test',
  jwtSecret: 'foshfnfoeawbosdnvosifgosjcolnjosigdfogvjh0e4wfsiladfv',
  origin: 'http://localhost:5173',
};

const prodConfig: Config = {
  port: 8080,
  dbUrl: 'mongodb://mongodb/GKerLove',
  dbUser: 'gkers',
  dbPass: 'gkers111666',
  dbAuthSource: 'admin',
  jwtSecret: 'foshfnfoeawbosdnvosifgosjcolnjosigdfogvjh0e4wfsiladfv',
  origin: 'https://love.gkers.cqupt-gyr.xyz',
};

const config = process.env.NODE_ENV === 'prod' ? prodConfig : devConfig;

export default config;
