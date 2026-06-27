import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });

    // THIS IS THE FIX: Tell Webpack exactly where to find this "missing" package
    config.resolve.alias = {
      ...config.resolve.alias,
      "kms_lib_bg.wasm": path.resolve(
        process.cwd(),
        "node_modules/fhevmjs/lib/kms_lib_bg.wasm"
      ),
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        os: false,
      };
    }

    return config;
  },
};

export default nextConfig;