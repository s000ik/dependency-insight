# Dependency Insight CLI Tool

## Overview
`dependency-insight` is a tiny, powerful, and user-friendly command-line tool designed to help you audit, analyze, and manage your project's dependencies. It provides a wide range of features to ensure that your project uses the most up-to-date, secure, and efficient libraries.

## Features

### 1. **Audit Dependencies**
- **Command**: `dep-insight audit`
- **Description**: Audits your project's dependencies for known vulnerabilities and displays the severity of each.
- **Output**:
    ```
    Auditing dependencies for vulnerabilities...

    Low: 2, Moderate: 3, High: 1, Critical: 0
    ```

### 2. **Check Outdated Dependencies**
- **Command**: `dep-insight outdated`
- **Description**: Identifies outdated dependencies and checks for newer versions.
- **Output**:
    ```
    Checking for outdated dependencies...

    Outdated dependencies:

    lodash: 4.17.15 → 4.18.0 (4.17.19)
    react: 16.8.0 → 17.0.4 (17.0.2)
    ```

### 3. **Prune Unused Dependencies**
- **Command**: `dep-insight prune`
- **Description**: Detects unused dependencies and helps keep your project lean.
- **Output**:
    ```
    Checking for unused dependencies...

    Unused dependencies found:
    - unused-package
    - another-unused-package (dev)

    Would you like to uninstall unused dependencies? (y/n)
    ```

### 4. **Visualize Dependency Tree**
- **Command**: `dep-insight tree`
- **Description**: Visualizes the complete dependency tree of your project.
- **Output**:
    ```
    Visualizing dependency tree...

    my-project@1.0.0
      ├─ lodash@4.17.19
      ├─ react@17.0.0
      └─ axios@0.21.1
        └─ lodash@4.17.19
    ```

### 5. **Suggest Lightweight Alternatives**
- **Command**: `dep-insight suggest`
- **Description**: Suggests lightweight alternatives for heavy dependencies.
- **Output**:
    ```
    Suggesting lightweight alternatives...

    Consider using date-fns instead of moment
    Consider using dayjs instead of luxon
    ```

### 6. **Analyze Bundle Size**
- **Command**: `dep-insight size`
- **Description**: Analyzes the size of your project's dependencies and provides a summary.
- **Output**:
    ```
    Analyzing dependency sizes...

    lodash                    2.50 MB
    react                    25.30 MB
    axios                   15.12 MB

    Total packages: 3
    Total size: 42.92 MB
    ```


### 7. **Check Project Health**
- **Command**: `dep-insight health`
- **Description**: Checks the health of your dependencies by reviewing download statistics, GitHub activity, and more.
- **Output**:
    ```
    Checking dependency health...

    lodash @4.17.19
    Monthly downloads: 1,000,000
    GitHub stars: 10,000
    Open issues: 50
    Last updated: 01/12/2024
    ```

### 8. **Interactive Update for Dependencies**
- **Command**: `dep-insight update`
- **Description**: Allows you to interactively update outdated dependencies in your project.
- **Output**:
    ```
    Updating dependencies...

    Installing lodash@4.18.0... ✓
    Installing react@17.0.2... ✓

    Successfully updated 2 package(s)
    ```

### 9. **Clear npm Cache**
- **Command**: `dep-insight clear-cache`
- **Description**: Clears the npm cache completely after confirming with the user.
- **Output**:
    ```
    Warning: This will clear your npm cache completely.

    Are you sure you want to clear the npm cache? (y/n)
    
    Clearing npm cache... ✓
    Successfully cleared npm cache
    ```

### 10. **Default/Help Command**
- **Command**: No command or `dep-insight help`
- **Description**: Displays the available commands and their descriptions when no command is provided or the help flag is used.
- **Output**:
    ```
    Dependency Insight CLI
    Usage:
      audit     - Audit dependencies for vulnerabilities
      outdated  - Check for outdated dependencies
      prune     - Check for unused dependencies
      tree      - Visualize dependency tree
      suggest   - Suggest lightweight alternatives for heavy dependencies
      size      - Analyze bundle size
      health    - Check project health
      update    - Interactive update for dependencies
      clear-cache - Clear npm cache
    ```

## Installation

You can install `dependency-insight` globally via npm:

```bash
npm install -g dependency-insight
```

Alternatively, you can install it locally in your project:

```bash
npm install --save-dev dependency-insight
```
Or simply npm i (but you may have to use npx before dep-insight)
```bash
npm install dependency-insight #use npx 
```

---

## Usage

After installation, you can run the tool from the command line by typing `dep-insight` followed by the desired command. For example:

- To audit dependencies:
  ```bash
  dep-insight audit
  ```
- To check for outdated dependencies:
  ```bash
  dep-insight outdated
  ```

For a full list of commands, use the help command:

```bash
dep-insight help
```

---

## Example Output

When you run the `dep-insight audit` command, it will analyze your dependencies for security vulnerabilities and output a summary:

```bash
Auditing dependencies for vulnerabilities...

Low: 2, Moderate: 1, High: 3, Critical: 0
```

When you run `dep-insight outdated`, it will show any outdated dependencies:

```bash
Outdated dependencies:

express: 4.16.3 → 4.18.2 (4.18.2)
```

### Interactive Update

When you run the `dep-insight update` command, you will be presented with a list of outdated dependencies and can choose which ones to update interactively:

```bash
dep-insight update

Select dependencies to update:

[x] express: 4.16.3 → 4.18.2
```

### Health Check

The `dep-insight health` command checks the health of each dependency, showing you GitHub statistics and download information:

```bash
Checking dependency health...

──────────────────────────────────────────────────
express @4.16.3
Monthly downloads: 5,000,000
GitHub stars: 12,345
Open issues: 25
Last updated: 15/12/2023
──────────────────────────────────────────────────
```

---

## Dependencies

This tool uses the following libraries:

- `chalk`: For colorful and easy-to-read outputs in the terminal. 
- `depcheck`: For identifying unused dependencies in your project.
- `inquirer`: For prompting users during interactive commands.
- `filesize`: For displaying file sizes in human-readable formats.

---

## Contributing

Feel free to fork this project, submit issues, or create pull requests. Contributions are welcome!

---

## License

This project is licensed under the **MIT** License. See the [LICENSE](LICENSE) file for more information.

---

**Note:** GitHub API is rate-limited to 60 requests per hour for unauthenticated requests, which may affect the `health` command.
