import "leaflet/dist/leaflet.css";
import "./styles.css";
import { App } from "./App";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app root");

void new App(root).start();
