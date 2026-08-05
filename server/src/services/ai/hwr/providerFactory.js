import env from "../../../config/env.js";
import MockHwrProvider from "./mock.provider.js";
import AzureHwrProvider from "./azure.provider.js";

export class HwrProviderFactory {
  static getProvider() {
    const provider = env.AI?.HWR_PROVIDER || "mock";
    switch (provider.toLowerCase()) {
    case "azure":
      return new AzureHwrProvider();
    case "mock":
    default:
      return new MockHwrProvider();
    }
  }
}

export default HwrProviderFactory;
