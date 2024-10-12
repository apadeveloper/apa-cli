#!/usr/bin/env node

import { execa } from 'execa';
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

const program = new Command();

program
  .version('1.0.0')
  .description('React Native project generator using custom template');

program
  .command('init <project-name>')
  .description('Create a new React Native project with the custom template')
  .option('-v, --version <version>', 'Specify template version', 'latest')
  .action(async (projectName, cmdObj) => {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'appName',
        message: 'What is your app name?',
        default: projectName,
      },
      {
        type: 'input',
        name: 'packageName',
        message: 'Enter the Android package name (e.g., com.example.app):',
        validate: (input) => {
          const valid = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(input);
          return valid || 'Please enter a valid package name (e.g., com.example.app)';
        }
      },
      {
        type: 'input',
        name: 'version',
        message: 'Enter the version of the template you want to use (e.g., v1.0.0), or press Enter for latest:',
        default: cmdObj.version,
      }
    ]);

    const { appName, packageName, version } = answers;
    const templateRepo = 'https://github.com/your-username/react-native-template'; // Your template repo

    console.log(chalk.green(`Cloning template version ${version} from ${templateRepo}`));
    try {
      const cloneCommand = version === 'latest'
        ? ['clone', templateRepo, projectName] // If 'latest', just clone the main branch
        : ['clone', '--branch', version, templateRepo, projectName]; // Else, clone the specific version

      await execa('git', cloneCommand);

      // Change directory into the project folder
      process.chdir(projectName);

      updateAppNameAndPackage(appName, packageName, projectName);

      console.log(chalk.green('Installing dependencies...'));
      await execa('npm', ['install']); // Or yarn install if you prefer

      console.log(chalk.green('Your project is ready!'));
      console.log(chalk.green(`cd ${projectName} && npm start`));
    } catch (error) {
      console.error(chalk.red('Error while cloning or setting up the project:'), error);
    }
  });

function updateAppNameAndPackage(appName, packageName, projectName) {
  const appJsonPath = path.join(process.cwd(), 'app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  appJson.name = appName;
  appJson.displayName = appName;
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));

  updateAndroidPackageName(packageName, projectName);
  updateIOSBundleIdentifier(packageName, appName);
}

function updateAndroidPackageName(packageName, projectName) {
  const androidManifestPath = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  const buildGradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');

  let androidManifest = fs.readFileSync(androidManifestPath, 'utf8');
  androidManifest = androidManifest.replace(/package="[^"]+"/, `package="${packageName}"`);
  fs.writeFileSync(androidManifestPath, androidManifest, 'utf8');

  let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
  buildGradle = buildGradle.replace(/applicationId ".*"/, `applicationId "${packageName}"`);
  fs.writeFileSync(buildGradlePath, buildGradle, 'utf8');

  const packagePath = packageName.replace(/\./g, '/');
  const oldPackagePath = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'java', 'com', projectName.toLowerCase());
  const newPackagePath = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'java', ...packageName.split('.'));
  fs.mkdirSync(newPackagePath, { recursive: true });
  fs.readdirSync(oldPackagePath).forEach(file => {
    fs.renameSync(path.join(oldPackagePath, file), path.join(newPackagePath, file));
  });
  fs.rmdirSync(oldPackagePath, { recursive: true });
}

function updateIOSBundleIdentifier(bundleIdentifier, appName) {
  const plistPath = path.join(process.cwd(), 'ios', `${appName}/Info.plist`);
  const projectPath = path.join(process.cwd(), 'ios', `${appName}.xcodeproj`, 'project.pbxproj');

  let plistContent = fs.readFileSync(plistPath, 'utf8');
  plistContent = plistContent.replace(/<key>CFBundleIdentifier<\/key>\s*<string>.*<\/string>/, `<key>CFBundleIdentifier</key>\n\t<string>${bundleIdentifier}</string>`);
  fs.writeFileSync(plistPath, plistContent, 'utf8');

  let projectContent = fs.readFileSync(projectPath, 'utf8');
  projectContent = projectContent.replace(/PRODUCT_BUNDLE_IDENTIFIER = .*;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${bundleIdentifier};`);
  fs.writeFileSync(projectPath, projectContent, 'utf8');
}

program.parse(process.argv);
