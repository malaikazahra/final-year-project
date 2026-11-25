module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),
        /Critical dependency: the request of a dependency is an expression/,
      ];

      return webpackConfig;
    },
  },
};
