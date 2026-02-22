import { NodeSSH } from "node-ssh";
import { readFileSync } from "fs";
import { join } from "path";
import type { WordPressCredentials } from "@/types/wordpress";

export async function deployMuPlugin(
  credentials: WordPressCredentials
): Promise<{ success: boolean; method: "ssh" | "manual"; message: string }> {
  if (!credentials.ssh_host || !credentials.ssh_user) {
    return {
      success: false,
      method: "manual",
      message:
        "SSH credentials not provided. Please manually upload dashboard-connector.php to wp-content/mu-plugins/ on the server. The shared secret is registered automatically.",
    };
  }

  const ssh = new NodeSSH();

  try {
    await ssh.connect({
      host: credentials.ssh_host,
      port: credentials.ssh_port || 22,
      username: credentials.ssh_user,
      ...(credentials.ssh_key ? { privateKey: credentials.ssh_key } : {}),
    });

    // Read the mu-plugin file
    const pluginContent = readFileSync(
      join(process.cwd(), "public", "mu-plugins", "dashboard-connector.php"),
      "utf-8"
    );

    // Detect WordPress path on the server
    const wpPath = await detectWordPressPath(ssh, credentials.site_url);
    if (!wpPath) {
      ssh.dispose();
      return {
        success: false,
        method: "ssh",
        message: "Could not detect WordPress installation path on the server.",
      };
    }

    const muPluginDir = `${wpPath}/wp-content/mu-plugins`;
    const muPluginFile = `${muPluginDir}/dashboard-connector.php`;

    // Create mu-plugins directory if needed and write the file
    await ssh.execCommand(`mkdir -p ${muPluginDir}`);
    await ssh.execCommand(`cat > ${muPluginFile} << 'DASHBOARD_CONNECTOR_EOF'
${pluginContent}
DASHBOARD_CONNECTOR_EOF`);
    await ssh.execCommand(`chmod 644 ${muPluginFile}`);

    ssh.dispose();

    return {
      success: true,
      method: "ssh",
      message: "mu-plugin deployed successfully via SSH.",
    };
  } catch (error) {
    ssh.dispose();
    return {
      success: false,
      method: "ssh",
      message: `SSH deployment failed: ${(error as Error).message}. Please install manually.`,
    };
  }
}

async function detectWordPressPath(
  ssh: NodeSSH,
  siteUrl: string
): Promise<string | null> {
  // Try to find wp-config.php
  const { stdout } = await ssh.execCommand(
    "find /var/www /home -name wp-config.php -maxdepth 5 2>/dev/null | head -5"
  );

  if (stdout.trim()) {
    const firstMatch = stdout.trim().split("\n")[0];
    if (firstMatch) {
      return firstMatch.replace("/wp-config.php", "");
    }
  }

  // Fallback: try common paths
  const hostname = new URL(siteUrl).hostname;
  const commonPaths = [
    `/var/www/${hostname}/public_html`,
    `/var/www/${hostname}/htdocs`,
    `/var/www/html`,
    `/home/${hostname}/public_html`,
    `/var/www/${hostname}`,
  ];

  for (const path of commonPaths) {
    const { stdout: check } = await ssh.execCommand(
      `test -f ${path}/wp-config.php && echo "found"`
    );
    if (check.trim() === "found") return path;
  }

  return null;
}
