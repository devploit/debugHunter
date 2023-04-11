# debugHunter - Chrome Extension

<p align="center">
<img src="https://i.imgur.com/QEUUM9w.png" width="600" height="150" >
</p>

[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/devploit/dontgo403/issues)

Discover hidden debugging parameters and uncover web application secrets with debugHunter. This Chrome extension scans websites for debugging parameters and notifies you when it finds a URL with modified responses. The extension utilizes a binary search algorithm to efficiently determine the parameter responsible for the change in the response.

## Features

- Perform a binary search on a list of predefined query parameters.
- Compare responses with and without query parameters to identify changes.
- Track and display the number of modified URLs in the browser action badge.
- Allow the user to view and clear the list of modified URLs.

## Installation

### Option 1: Clone the repository

1. Download or clone this repository to your local machine.
2. Open Google Chrome, and go to `chrome://extensions/`.
3. Enable "Developer mode" in the top right corner if it's not already enabled.
4. Click the "Load unpacked" button on the top left corner.
5. Navigate to the directory where you downloaded or cloned the repository, and select the folder.
6. The debugHunter extension should now be installed and ready to use.

### Option 2: Download the release (.zip)

1. Download the latest release `.zip` file from the "Releases" section of this repository.
2. Extract the contents of the `.zip` file to a folder on your local machine.
3. Open Google Chrome, and go to `chrome://extensions/`.
4. Enable "Developer mode" in the top right corner if it's not already enabled.
5. Click the "Load unpacked" button on the top left corner.
6. Navigate to the directory where you extracted the `.zip` file, and select the folder.
7. The debugHunter extension should now be installed and ready to use.

## Usage

It is recommended to pin the extension to the toolbar to check if a new modified URL by debug parameter is found.
1. Navigate to any website.
2. Click on the debugHunter extension icon in the Chrome toolbar.
3. If the extension detects any URLs with modified responses due to debugging parameters, they will be listed in the popup.
4. Click on any URL in the list to open it in a new tab.
5. To clear the list, click on the trash can icon in the top right corner of the popup.

## Options/Customization

To modify the similarity threshold using the options page of the extension, follow these steps:
1. Click on the debugHunter extension icon in the Chrome toolbar.
2. Click on the gear icon in the top right corner of the popup to open the options page.
3. In the options page, use the slider to set the similarity threshold to the desired value (default 0.92).

## Contributing

We welcome contributions! Please feel free to submit pull requests or open issues to improve debugHunter.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
