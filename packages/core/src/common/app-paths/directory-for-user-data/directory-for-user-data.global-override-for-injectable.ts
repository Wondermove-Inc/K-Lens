import { getGlobalOverride } from "@skuberplus/test-utils";
import directoryForUserDataInjectable from "./directory-for-user-data.injectable";

export default getGlobalOverride(directoryForUserDataInjectable, () => "/mock/user-data");
