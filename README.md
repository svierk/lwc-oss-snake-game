# 🐍 LWC OSS Snake Game

![GitHub CI](https://github.com/svierk/lwc-oss-snake-game/actions/workflows/ci.yaml/badge.svg)

The project was born out of pure interest in using Lightning Web Components outside of the Salesforce platform.
I was inspired to the Snake idea by the following blog article and reused some of the game code:

[How to Build the Snake Game Using Lightning Web Components](https://developer.salesforce.com/blogs/2020/09/how-to-build-the-snake-game-using-lightning-web-components)

If you are also interested in LWC OSS you can find more info here: https://lwc.dev/

## Preview

<img src="./preview.png" alt="preview" width="400">

## Project Setup

The directory structure looks like this:

```
src/
  ├── assets/           // static assets
  │   └── fonts/
  │   └── icons/
  │   └── images/
  │   └── styles/
  |   └── favicon.ico
  └── layouts/          // lwc layouts
  │   └── main.html
  └── modules/          // lwc modules
      └── snake/
          └── app/
              ├── app.css
              ├── app.html
              └── app.js
          └── game/
              ├── game.css
              ├── game.html
              └── game.js
lwr.config.json         // lwr configuration
package.json            // npm packaging configuration
```

## Configuration

The LWR server is configured in `lwr.config.json`, at the root of the project. It has two LWC module and one server-side route.

```json
// lwr.config.json
{
  "lwc": { "modules": [{ "dir": "$rootDir/src/modules" }] },
  "routes": [
    {
      "id": "example",
      "path": "/",
      "rootComponent": "example/app"
    }
  ],
  "assets": [
    {
      "alias": "assetsDir",
      "dir": "$rootDir/src/assets",
      "urlPath": "/public/assets"
    },
    {
      "alias": "favicon",
      "file": "$rootDir/src/assets/favicon.ico",
      "urlPath": "/favicon.ico"
    }
  ]
}
```

## Running Linter and Prettier

```bash
yarn run prettier
yarn run lint
```

## Running the Project in Dev Mode

```bash
yarn install
yarn dev # dev:compat for AMD format
```

Open the site at [http://localhost:3000](http://localhost:3000)

## Statically Generate and Preview the Site

```bash
yarn build # dev:prod-compat for AMD format
yarn start
```

Open the site at [http://localhost:3000](http://localhost:3000)
