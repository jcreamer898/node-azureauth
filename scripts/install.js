import path from "path";
import fs from "fs";
import { DownloaderHelper } from "node-downloader-helper";
import decompress from "decompress";

const __dirname = path.dirname(new URL(import.meta.url).pathname).substring(1);

async function download(url, saveDirectory) {
  const downloader = new DownloaderHelper(url, saveDirectory);
  return new Promise((resolve, reject) => {
    downloader.on("end", () => resolve());
    downloader.on("error", (err) => reject(err));
    downloader.on("progress.throttled", (downloadEvents) => {
      const percentageComplete =
        downloadEvents.progress < 100
          ? downloadEvents.progress.toPrecision(2)
          : 100;
      console.info(`Downloaded: ${percentageComplete}%`);
    });
    downloader.start();
  });
}

const platform = process.platform;
const arch = process.arch;

const AZUREAUTH_INFO = {
  name: "azureauth",
  // https://github.com/AzureAD/microsoft-authentication-cli/releases/download/0.8.2/azureauth-0.8.2-osx-arm64.tar.gz
  // https://github.com/AzureAD/microsoft-authentication-cli/releases/download/0.8.2/azureauth-0.8.2-osx-x64.tar.gz
  // https://github.com/AzureAD/microsoft-authentication-cli/releases/download/0.8.2/azureauth-0.8.2-win10-x64.zip
  url: "https://github.com/AzureAD/microsoft-authentication-cli/releases/download/",
  version: "0.8.2",
};

const AZUREAUTH_NAME_MAP = {
  def: "azureauth",
  win32: "azureauth.exe",
  linux: "azureauth.exe",
};

export const AZUREAUTH_NAME =
  platform in AZUREAUTH_NAME_MAP
    ? AZUREAUTH_NAME_MAP[platform]
    : AZUREAUTH_NAME_MAP.def;

export const install = async () => {
  const OUTPUT_DIR = path.join(__dirname, "..", "bin");
  const fileExist = (path) => {
    try {
      return fs.existsSync(path);
    } catch (err) {
      return false;
    }
  };

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
    console.info(`${OUTPUT_DIR} directory was created`);
  }

  if (fileExist(path.join(OUTPUT_DIR, "azureauth", AZUREAUTH_NAME))) {
    console.log("azureauth is already installed");
    return;
  }
  // if platform is missing, download source instead of executable
  const DOWNLOAD_MAP = {
    win32: {
      def: "azureauth.exe",
      x64: "azureauth-0.8.2-win10-x64.zip",
    },
    darwin: {
      def: "azureauth",
      x64: "azureauth-0.8.2-osx-x64.tar.gz",
    },
    // TODO: support linux when the binaries are available
    // linux: {
    //   def: "azureauth.exe",
    //   x64: "azureauth-0.8.2-win10-x64.zip",
    // },
  };
  if (platform in DOWNLOAD_MAP) {
    // download the executable
    const filename =
      arch in DOWNLOAD_MAP[platform]
        ? DOWNLOAD_MAP[platform][arch]
        : DOWNLOAD_MAP[platform].def;

    const url = `${AZUREAUTH_INFO.url}${AZUREAUTH_INFO.version}/${filename}`;
    const distPath = path.join(OUTPUT_DIR, "azureauth");
    const archivePath = path.join(OUTPUT_DIR, filename);

    console.log(`Downloading azureauth from ${url}`);
    await download(url, OUTPUT_DIR);

    console.log(`Downloaded in ${OUTPUT_DIR}`);

    // Make a dir to uncompress the zip or tar into
    fs.mkdirSync(distPath, {
      recursive: true,
    });

    const binaryPath = path.join(distPath, AZUREAUTH_NAME);

    await decompress(archivePath, distPath);

    if (fileExist(binaryPath)) {
      fs.chmodSync(binaryPath, fs.constants.S_IXUSR || 0o100);
      // Huan(202111): we need the read permission so that the build system can pack the node_modules/ folder,
      // i.e. build with Heroku CI/CD, docker build, etc.
      fs.chmodSync(binaryPath, 0o755);
    }

    console.log(`Unzipped in ${archivePath}`);
    fs.unlinkSync(archivePath);
  }
};

await install();
