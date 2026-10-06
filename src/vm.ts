import type App from "./App";

/** The view model App.renderVals() builds; every generated view renders from it. */
export type VM = ReturnType<App["renderVals"]>;
