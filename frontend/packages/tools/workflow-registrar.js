const childProcess = require("child_process");
const fs = require("fs");

const config = require(`${process.argv[2]}/clutch.config.js`); // eslint-disable-line import/no-dynamic-require

const WORKFLOW_MODULE_PATH = `${process.argv[2]}/workflows.jsx`;

const addImport = workflow => {
  let moduleNameParts = [workflow];
  if (workflow.includes("/")) {
    const packageName = workflow.split("/")[1];
    moduleNameParts = [packageName];
    if (packageName.includes("-")) {
      moduleNameParts = packageName.split("-");
    }
  }
  const moduleName = moduleNameParts
    .map((part, idx) => {
      if (idx === 0) {
        return part;
      }
      return part.replace(/^\w/, c => c.toUpperCase());
    })
    .join("");
  fs.appendFileSync(
    WORKFLOW_MODULE_PATH,
    `import { default as ${moduleName}} from "${workflow}";\n`
  );
  console.log(`Registered ${moduleName} workflow...`); // eslint-disable-line no-console
  return moduleName;
};

const discoverWorkflows = () => {
  return new Promise(resolve => {
    fs.appendFileSync(WORKFLOW_MODULE_PATH, `/* eslint-disable */\n`);
    fs.appendFileSync(WORKFLOW_MODULE_PATH, `/*\n * This file is autogenerated. DO NOT MODIFY BY HAND!\n`);
    fs.appendFileSync(WORKFLOW_MODULE_PATH, ` * Run the @clutch-sh/tools registerWorkflows target instead\n*/\n`);
    const packagePattern = Object.keys(config).join("|");
    return childProcess.exec(
      `yarn list --json --depth=0 --pattern '${packagePattern}'`,
      {
        cwd: ".",
      },
      (err, stdout) => {
        if (err) {
          throw err;
        }
        const modules = {};
        JSON.parse(stdout).data.trees.forEach(p => {
          const packageName = `@${p.name.split("@")[1]}`;
          modules[packageName] = addImport(packageName);
        });
        return resolve(modules);
      }
    );
  });
};

try {
  fs.unlinkSync(WORKFLOW_MODULE_PATH);
} catch (err) {}
return discoverWorkflows().then(modules => {
  fs.appendFileSync(WORKFLOW_MODULE_PATH, `\nconst registeredWorkflows = {\n`);
  Object.keys(modules).forEach(moduleKey => {
    const value = modules[moduleKey];
    fs.appendFileSync(WORKFLOW_MODULE_PATH, `  "${moduleKey}": ${value},\n`);
  });
  fs.appendFileSync(WORKFLOW_MODULE_PATH, `};\nexport default registeredWorkflows;`);
  console.log("Generated Workflow imports!"); // eslint-disable-line no-console
});
