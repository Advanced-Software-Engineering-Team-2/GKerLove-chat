interface Config {
  dbUrl: string;
  dbUser: string;
  dbPass: string;
  dbAuthSource: string;
  jwtSecret: string;
}

const devConfig: Config = {
  dbUrl: 'mongodb://server.cqupt-gyr.xyz/GKerLove',
  dbUser: 'gkers',
  dbPass: 'gkers111666',
  dbAuthSource: 'test',
  jwtSecret: 'foshfnfoeawbosdnvosifgosjcolnjosigdfogvjh0e4wfsiladfv',
};

const prodConfig: Config = {
  dbUrl: 'mongodb://mongodb/GKerLove',
  dbUser: 'gkers',
  dbPass: 'gkers111666',
  dbAuthSource: 'admin',
  jwtSecret: 'foshfnfoeawbosdnvosifgosjcolnjosigdfogvjh0e4wfsiladfv',
};

const config = process.env.NODE_ENV === 'prod' ? prodConfig : devConfig;

export default config;
