import { mountApp } from "./app";
import "./styles.css";

const app = document.querySelector<HTMLElement>("#app");
if (!app) {
  throw new Error("Missing #app element");
}

mountApp(app);
