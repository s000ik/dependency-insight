#!/usr/bin/env node

/**
 * Dependency Insight CLI
 * A tool for analyzing and managing project dependencies
 */


// Core Node.js imports
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");


// Third-party dependencies
const chalk = require("chalk");
const depcheck = require("depcheck");


const importInquirer = async () => {
  try {
    const module = await import('inquirer');
    return module.default;
  } catch (error) {
    console.error(chalk.red("Error: The 'inquirer' package is required but not installed."));
    console.log(chalk.yellow("Please install it using: npm install inquirer"));
    process.exit(1);
  }
};


// =====================================
// Utility Functions
// =====================================

const execCommand = (command) => {
  try {
    const result = execSync(command, { encoding: "utf-8", stdio: "pipe" });
    return command.includes("--json") ? JSON.parse(result) : result;
  } catch (error) {
    if (error.stdout && command.includes("--json")) {
      try {
        return JSON.parse(error.stdout);
      } catch (e) {}
    }

    console.error(chalk.red(`Error executing: ${command}`));
    console.error(error.message);
    if (error.stdout) console.error(chalk.yellow(`Stdout: ${error.stdout}`));
    if (error.stderr) console.error(chalk.yellow(`Stderr: ${error.stderr}`));
    return null;
  }
};

// =====================================
// API Interactions
// =====================================

/**
 * Makes HTTP GET request with rate limit handling
 * @param {string} url - API endpoint URL
 * @returns {Promise<object|null>} Parsed JSON response
 */

const makeRequest = (url) => {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: { "User-Agent": "dep-insight-cli" },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            if (res.statusCode === 429) {
              console.log(
                chalk.red("Rate limit reached. Please try again later.")
              );
              resolve(null);
            } else if (res.statusCode === 200) {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                resolve(null);
              }
            } else {
              resolve(null);
            }
          });
        }
      )
      .on("error", () => resolve(null));
  });
};

const checkDownloads = async (pkg) => {
  try {
    const data = await makeRequest(
      `https://api.npmjs.org/downloads/point/last-month/${pkg}`
    );
    return data?.downloads;
  } catch (e) {
    return null;
  }
};

const checkGitHub = async (pkg) => {
  try {
    const pkgPath = path.join(
      process.cwd(),
      "node_modules",
      pkg,
      "package.json"
    );
    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const repoUrl = pkgJson.repository?.url || pkgJson.repository;

    if (repoUrl) {
      const githubUrl = repoUrl
        .replace("git+", "")
        .replace(".git", "")
        .replace("git:", "https:");
      const apiUrl = githubUrl.replace("github.com", "api.github.com/repos");
      await new Promise((resolve) => setTimeout(resolve, 100));

      const data = await makeRequest(apiUrl);
      if (!data) return null;

      return {
        stars: data.stargazers_count,
        issues: data.open_issues_count,
        updated: data.updated_at,
      };
    }
    return null;
  } catch (e) {
    return null;
  }
};

// =====================================
// Core Commands
// =====================================

// Command: Audit dependencies for vulnerabilities
const auditDependencies = () => {
  console.log(chalk.blue("Auditing dependencies for vulnerabilities...\n"));
  const result = execCommand("npm audit --json");
  if (result) {
    // Show summary counts first
    const issues = result.metadata.vulnerabilities;
    console.log(chalk.bold("Summary:"));
    console.log(
      chalk.green(
        `Low: ${issues.low}, Moderate: ${issues.moderate}, High: ${issues.high}, Critical: ${issues.critical}\n`
      )
    );

    // Show detailed vulnerabilities
    if (result.advisories) {
      console.log(chalk.bold("Details:"));
      Object.values(result.advisories).forEach(advisory => {
        console.log(chalk.dim("─".repeat(60)));
        console.log(`${chalk.red(advisory.title)} (${chalk.yellow(advisory.severity)})`);
        console.log(`Vulnerable package: ${chalk.cyan(advisory.module_name)}`);
        console.log(`Patched in: ${chalk.green(advisory.patched_versions)}`);
        console.log(`Path: ${advisory.findings[0]?.paths[0] || 'N/A'}`);
        console.log(`More info: ${chalk.blue(advisory.url)}\n`);
      });
    }

    // Show fix recommendations
    if (result.metadata.vulnerabilities.total > 0) {
      console.log(chalk.yellow("\nRecommended actions:"));
      console.log(chalk.dim("Run 'npm audit fix' to automatically fix fixable vulnerabilities"));
      console.log(chalk.dim("Run 'npm audit fix --force' to force fixes (may include breaking changes)"));
    }
  }
};

// Command: Check outdated dependencies
const checkOutdated = () => {
  console.log(chalk.blue("Checking for outdated dependencies...\n"));
  const result = execCommand("npm outdated --json");
  if (result) {
    if (Object.keys(result).length === 0) {
      console.log(chalk.green("All dependencies are up to date!"));
    } else {
      console.log(chalk.yellow("Outdated dependencies: Current → Latest (Suggested)\n"));
      Object.entries(result).forEach(([dep, info]) => {
        console.log(
          `${chalk.bold(dep)}: ${chalk.red(info.current)} → ${chalk.green(
            info.latest
          )} (${chalk.yellow(info.wanted)})`
        );
      });
    }
  }
};

// Command: Prune unused dependencies
const pruneDependencies = async () => {
  console.log(chalk.blue("Checking for unused dependencies...\n"));
  const packageJsonPath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    console.error(chalk.red("No package.json found in the current directory!"));
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const dependencies = Object.keys(packageJson.dependencies || {});
  const devDependencies = Object.keys(packageJson.devDependencies || {});

  console.log(chalk.yellow("Running analysis..."));
  depcheck(process.cwd(), { ignoreDirs: ["node_modules"] }, async (unused) => {
    const unusedDeps = unused.dependencies;
    const unusedDevDeps = unused.devDependencies;

    if (unusedDeps.length || unusedDevDeps.length) {
      console.log(chalk.red("Unused dependencies found:\n"));
      unusedDeps.forEach((dep) => console.log(chalk.red(`- ${dep}`)));
      unusedDevDeps.forEach((dep) => console.log(chalk.red(`- ${dep} (dev)`)));

      // Get inquirer instance
      const inquirer = await importInquirer();

      const { shouldUninstall } = await inquirer.prompt({
        type: "confirm",
        name: "shouldUninstall",
        message: "Would you like to uninstall unused dependencies?",
        default: false
      });

      if (shouldUninstall) {
        const choices = [
          ...unusedDeps.map(dep => ({ name: dep, value: dep, type: "prod" })),
          ...unusedDevDeps.map(dep => ({ name: `${dep} (dev)`, value: dep, type: "dev" }))
        ];

        const { selected } = await inquirer.prompt({
          type: "checkbox",
          name: "selected",
          message: "Select dependencies to uninstall:",
          choices
        });

        if (selected.length) {
          console.log(chalk.blue("\nUninstalling dependencies...\n"));
          const startTime = Date.now();

          for (const dep of selected) {
            process.stdout.write(chalk.yellow(`Uninstalling ${dep}... `));
            try {
              execCommand(`npm uninstall ${dep}`);
              console.log(chalk.green("✓"));
            } catch (error) {
              console.log(chalk.red("✗"));
              console.log(
                chalk.red(`Error uninstalling ${dep}: ${error.message}`)
              );
            }
          }

          const duration = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(
            chalk.green(
              `\n✨ Successfully uninstalled ${selected.length} package(s) in ${duration}s`
            )
          );
        } else {
          console.log(
            chalk.yellow("\nNo packages selected for uninstallation.")
          );
        }
      }
    } else {
      console.log(chalk.green("No unused dependencies found!"));
    }
  });
};

// Command: Visualize dependency tree
const visualizeTree = () => {
  console.log(chalk.blue("Visualizing dependency tree...\n"));

  const packageJsonPath = path.join(process.cwd(), "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

  // Use npm list to get dependency tree
  const result = execCommand("npm list --json");
  if (!result) return;

  const printDependencyTree = (deps, level = 0) => {
    const indent = "  ".repeat(level);

    Object.entries(deps).forEach(([name, info]) => {
      if (name === "dependencies") {
        printDependencyTree(info, level);
        return;
      }

      const version = info.version || "unknown";
      console.log(`${indent}${chalk.bold(name)}@${chalk.green(version)}`);

      // Check for peer dependencies
      const depPath = path.join(
        process.cwd(),
        "node_modules",
        name,
        "package.json"
      );
      try {
        const depPackage = JSON.parse(fs.readFileSync(depPath, "utf-8"));
        if (depPackage.peerDependencies) {
          Object.entries(depPackage.peerDependencies).forEach(
            ([peer, range]) => {
              console.log(
                `${indent}  ${chalk.yellow("└─")} ${chalk.dim(
                  `requires ${peer}@${range}`
                )}`
              );
            }
          );
        }
      } catch (e) {}

      // Recurse into nested dependencies
      if (info.dependencies) {
        printDependencyTree(info.dependencies, level + 1);
      }
    });
  };

  console.log(
    `${chalk.bold(packageJson.name)}@${chalk.green(packageJson.version)}`
  );
  printDependencyTree(result);
};

// =====================================
// Analysis Commands
// =====================================

// Command: Analyze bundle size
const analyzeSize = () => {
  console.log(chalk.blue("Analyzing dependency sizes...\n"));
  const result = execCommand("npm list --json");
  if (!result) return;

  // Get total size of directory recursively
  const getTotalSizeInMB = (dirPath) => {
    let totalSize = 0;
    try {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        // Skip certain files/directories
        if (file === "." || file === ".." || file === ".git") continue;

        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isSymbolicLink()) {
          // Handle symlinks differently
          continue;
        } else if (stats.isDirectory()) {
          const dirSize = getTotalSizeInMB(filePath);
          totalSize += dirSize * 1024 * 1024; // Convert MB back to bytes
        } else if (stats.isFile()) {
          totalSize += stats.size;
        }
      }
    } catch (e) {
      console.error(chalk.red(`Error reading ${dirPath}: ${e.message}`));
      return 0;
    }
    return (totalSize / (1024 * 1024)).toFixed(2); // Convert bytes to MB
  };

  // Get package sizes with validation
  const packageSizes = Object.keys(result.dependencies)
    .map((dep) => {
      const depPath = path.join(process.cwd(), "node_modules", dep);
      if (!fs.existsSync(depPath)) {
        console.warn(chalk.yellow(`Warning: ${dep} not found in node_modules`));
        return { name: dep, size: 0 };
      }
      const size = getTotalSizeInMB(depPath);
      return { name: dep, size: parseFloat(size) };
    })
    .filter((pkg) => pkg.size > 0) // Remove zero-size packages
    .sort((a, b) => b.size - a.size);

  // Display results with improved formatting
  packageSizes.forEach(({ name, size }) => {
    let color = chalk.green; // < 1MB
    if (size > 10) color = chalk.red; // > 10MB
    else if (size > 5) color = chalk.yellow; // 5-10MB

    const sizeString = size.toFixed(2).padStart(6);
    console.log(`${chalk.bold(name.padEnd(30))} ${color(sizeString + " MB")}`);
  });

  // Show total size and package count
  const totalSize = packageSizes.reduce((sum, pkg) => sum + pkg.size, 0);
  console.log(`\n${chalk.blue("Total packages:")} ${packageSizes.length}`);
  console.log(
    `${chalk.blue("Total size:")} ${chalk.bold(totalSize.toFixed(2) + " MB")}`
  );
};

// Suggesting lightweight alternatives for heavy dependencies
const suggestAlternatives = () => {
  console.log(chalk.blue("Suggesting lightweight alternatives...\n"));

  const largeDeps = {
    moment: "date-fns",
    luxon: "dayjs",
    lodash: "lodash-es",
    ramda: "ramda-adjunct",
    axios: "fetch",
    superagent: "undici",
    "string.js": "string",
    "sprintf-js": "tiny-sprintf",
    jquery: "vanilla JS",
    zepto: "vanilla JS",
    "chart.js": "chartist",
    d3: "chart.js",
    validator: "is.js",
    joi: "yup",
    redux: "valtio",
    mobx: "effector",
    "moment-timezone": "timezone-mock",
    fullcalendar: "flatpickr",
    animejs: "gsap",
    "socket.io": "ws",
    "react-router": "wouter",
    highcharts: "chart.js",
    "plotly.js": "chartist",
    dropzone: "fine-uploader",
    mathjs: "decimal.js",
    numeral: "vanilla JS",
    sharp: "image-size",
    fabric: "konva",
    bootstrap: "bulma",
    tailwindcss: "tachyons",
  };

  const result = execCommand("npm ls --json");
  if (result) {
    const root = result.dependencies;
    const suggestions = [];

    Object.entries(root).forEach(([dep]) => {
      if (largeDeps[dep]) {
        suggestions.push(`Consider using ${largeDeps[dep]} instead of ${dep}`);
      }
    });

    if (suggestions.length === 0) {
      console.log(chalk.green("No suggestions at the moment."));
    } else {
      suggestions.forEach((msg) => console.log(chalk.yellow(msg)));
    }
  }
};

// Command: Check project health
const checkHealth = async () => {
  console.log(chalk.blue("Checking dependency health...\n"));
  console.log(
    chalk.yellow(
      "Note: GitHub API has a rate limit of 60 requests per hour for unauthenticated requests.\n"
    )
  );

  const packageJsonPath = path.join(process.cwd(), "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  // Column formatting
  const COLS = {
    label: 18,
    value: 15,
  };

  const pad = (str, len) => str.toString().padEnd(len);
  const padLeft = (str, len) => str.toString().padStart(len);

  const formatNumber = (num) => {
    if (!num) return "N/A".padStart(COLS.value);
    return num.toLocaleString("en-IN").padStart(COLS.value);
  };

  console.log(chalk.yellow("Analyzing dependencies health metrics...\n"));

  for (const [pkg, version] of Object.entries(dependencies)) {
    console.log(
      chalk.dim("──────────────────────────────────────────────────")
    );
    console.log(
      `${chalk.bold.blue(pkg)} ${chalk.dim("@")}${chalk.cyan(version)}`
    );

    // Get downloads
    const downloads = await checkDownloads(pkg);
    if (downloads) {
      const color =
        downloads > 1000000
          ? chalk.green
          : downloads > 100000
          ? chalk.yellow
          : chalk.red;
      console.log(
        `${chalk.dim(pad("Monthly downloads:", COLS.label))}${color(
          formatNumber(downloads)
        )}`
      );
    } else {
      console.log(
        `${chalk.dim(pad("Monthly downloads:", COLS.label))}${chalk.dim("N/A")}`
      );
    }

    // Get GitHub stats
    const stats = await checkGitHub(pkg);
    if (stats) {
      const starsColor =
        stats.stars > 10000
          ? chalk.green
          : stats.stars > 1000
          ? chalk.yellow
          : chalk.white;
      const issuesColor =
        stats.issues < 100
          ? chalk.green
          : stats.issues < 500
          ? chalk.yellow
          : chalk.red;

      console.log(
        `${chalk.dim(pad("GitHub stars:", COLS.label))}${starsColor(
          formatNumber(stats.stars)
        )}`
      );
      console.log(
        `${chalk.dim(pad("Open issues:", COLS.label))}${issuesColor(
          formatNumber(stats.issues)
        )}`
      );

      const date = new Date(stats.updated).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      console.log(
        `${chalk.dim(pad("Last updated:", COLS.label))}${chalk.cyan(
          padLeft(date, COLS.value)
        )}`
      );
    } else {
      console.log(
        `${chalk.dim(pad("GitHub stats:", COLS.label))}${chalk.dim("N/A")}`
      );
    }

    console.log(""); // Empty line between packages
  }

  console.log(chalk.dim("──────────────────────────────────────────────────"));
};

// =====================================
// Maintenance & CLI Commands
// =====================================

// Command: Interactive update for dependencies
const interactiveUpdate = async () => {
  // Get inquirer instance using the importInquirer helper
  const inquirer = await importInquirer();

  const outdated = execCommand("npm outdated --json");
  if (!outdated || Object.keys(outdated).length === 0) {
    console.log(chalk.green("All dependencies are up to date!"));
    return;
  }

  const choices = Object.entries(outdated).map(([dep, info]) => ({
    name: `${dep}: ${info.current} → ${info.latest}`,
    value: { name: dep, version: info.latest },
  }));

  const { selected } = await inquirer.prompt({
    type: "checkbox",
    name: "selected",
    message: "Select dependencies to update:",
    choices,
  });

  if (selected.length) {
    console.log(chalk.blue("\nUpdating dependencies...\n"));
    const startTime = Date.now();

    for (const dep of selected) {
      process.stdout.write(
        chalk.yellow(`Installing ${dep.name}@${dep.version}... `)
      );

      try {
        execCommand(`npm install ${dep.name}@${dep.version}`);
        console.log(chalk.green("✓"));
      } catch (error) {
        console.log(chalk.red("✗"));
        console.log(chalk.red(`Error updating ${dep.name}: ${error.message}`));
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      chalk.green(
        `\n✨ Successfully updated ${selected.length} package(s) in ${duration}s`
      )
    );
  } else {
    console.log(chalk.yellow("No packages selected for update."));
  }
};

// Command: Clear npm cache
const clearCache = async () => {
  const inquirer = await importInquirer();
  
  console.log(chalk.yellow("Warning: This will clear your npm cache completely.\n"));

  const { confirmed } = await inquirer.prompt({
    type: "confirm",
    name: "confirmed",
    message: "Are you sure you want to clear the npm cache?",
    default: false
  });

  if (confirmed) {
    console.log(chalk.blue("\nClearing npm cache..."));
    execCommand("npm cache clean --force");
    console.log(chalk.green("✨ Successfully cleared npm cache"));
  } else {
    console.log(chalk.yellow("\nOperation aborted"));
  }
};

//  CLI Options
const main = async () => {
  const args = process.argv.slice(2);

  switch (args[0]) {
    case "audit":
      auditDependencies();
      break;
    case "outdated":
      checkOutdated();
      break;
    case "prune":
      pruneDependencies();
      break;
    case "tree":
      visualizeTree();
      break;
    case "suggest":
      suggestAlternatives();
      break;
    case "size":
      analyzeSize();
      break;
    case "health":
      await checkHealth();
      console.log(
        chalk.yellow(
          "Note: GitHub API has a rate limit of 60 requests per hour for unauthenticated requests.\n"
        )
      );
      break;
    case "update":
      interactiveUpdate();
      break;
    case "clear-cache":
      clearCache();
      break;
    default:
      console.log(chalk.blue("Dependency Insight CLI"));
      console.log("Usage:");
      console.log("  audit       - Audit dependencies for vulnerabilities");
      console.log("  outdated    - Check for outdated dependencies");
      console.log("  update      - Interactive update for dependencies");
      console.log("  prune       - Check for unused dependencies");
      console.log("  tree        - Visualize dependency tree");
      console.log(
        "  suggest     - Suggest lightweight alternatives for heavy dependencies"
      );
      console.log("  size        - Analyze bundle size");
      console.log("  health      - Check project health");
      console.log("  clear-cache - Clear npm cache");
      break;
  }
};

main().catch(error => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});