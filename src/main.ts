import "./ui/styles.css";
import { App } from "./ui/app";

const root = document.getElementById("app");
if (!root) throw new Error("#app root element not found");

new App(root);
