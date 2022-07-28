@svetch/bytenode-webpack-plugin
---

[![ci][badge-workflow-ci]][badge-workflow-ci-link]
[![coveralls][badge-coveralls]][badge-coveralls-link]
[![npm][badge-npm]][badge-npm-link]
[![license][badge-license]][badge-license-link]

[badge-coveralls]: https://img.shields.io/coveralls/github/svetch/bytenode-webpack-plugin?logo=coveralls&style=flat-square
[badge-coveralls-link]: https://coveralls.io/github/svetch/bytenode-webpack-plugin
[badge-license]: https://img.shields.io/github/license/svetch/bytenode-webpack-plugin?style=flat-square
[badge-license-link]: LICENSE
[badge-npm]: https://img.shields.io/npm/v/@svetch/bytenode-webpack-plugin?logo=npm&style=flat-square
[badge-npm-link]: https://www.npmjs.com/package/@svetch/bytenode-webpack-plugin
[badge-workflow-ci]: https://img.shields.io/github/workflow/status/svetch/bytenode-webpack-plugin/ci?label=ci&logo=github&style=flat-square
[badge-workflow-ci-link]: https://github.com/svetch/bytenode-webpack-plugin/actions/workflows/ci.yml

Compile JavaScript into bytecode using [`bytenode`][link-to-bytenode].  
Inspired by [`bytenode-webpack-plugin`][link-to-bytenode-webpack-plugin].

[link-to-bytenode-webpack-plugin]: https://www.npmjs.com/package/bytenode-webpack-plugin
[link-to-bytenode]: https://www.npmjs.com/package/bytenode

### Install
```shell
npm install --save @svetch/bytenode-webpack-plugin
```

### Supports
- [`electron-forge`][link-to-electron-forge]
  - :heavy_check_mark:  Default configuration
- [`webpack`][link-to-webpack]
  - :heavy_check_mark:  v4
  - :grey_question:  v5
  - :heavy_check_mark:   `entry` as a `string` (e.g., `'src/index.js'`)
  - :heavy_check_mark:   `entry` as an `array` (e.g., `['src/index.js']`)
  - :heavy_check_mark:   `entry` as an `object` (e.g., `{ main: 'src/index.js' }`)
  - :heavy_check_mark:   `entry` middlewares (e.g., `['src/index.js', 'webpack-hot-middleware/client']`)
  - :heavy_check_mark:   Dynamic `output.filename` (e.g., `'[name].js'`)
  - :heavy_check_mark:   Named `output.filename` (e.g., `'index.js'`)

[link-to-electron-forge]: https://www.npmjs.com/package/electron-forge
[link-to-webpack]: https://www.npmjs.com/package/webpack

### Usage
```javascript
import { BytenodeWebpackPlugin } from '@svetch/bytenode-webpack-plugin';

// webpack options
module.exports = {
  // ...

  plugins: [
    // using all defaults
    new BytenodeWebpackPlugin(),

    // overriding an option
    new BytenodeWebpackPlugin({
      compileForElectron: true,
    }),
  ],
};
```

### Options
```typescript
interface Options {
  compileAsModule: boolean;    // wraps the code in a node module
  compileForElectron: boolean; // compiles for electron instead of plain node
  debugLifecycle: boolean;     // enables webpack hooks lifecycle logs
  debugLogs: boolean;          // enables debug logs
  keepSource: boolean;         // emits the original source files along with the compiled ones
  preventSourceMaps: boolean;  // prevents source maps from being generated
  silent: boolean;             // disables all logs, but not errors thrown (overrides debug flags)
}
```

#### Default options
```typescript
new BytenodeWebpackPlugin({
  compileAsModule: true,
  compileForElectron: false,
  debugLifecycle: false,
  debugLogs: false,
  keepSource: false,
  preventSourceMaps: true,
  silent: false,
})
```

### Contributors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/svetch">
        <img src="https://avatars.githubusercontent.com/u/5903869?v=4" width="120;" alt="svetch"/>
        <br />
        <sub><b>svetch</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/jjeff">
        <img src="https://avatars.githubusercontent.com/u/321284?v=4" width="120;" alt="jjeff"/>
        <br />
        <sub><b>Jeff Robbins</b></sub>
      </a>
    </td>
  </tr>
</table>
