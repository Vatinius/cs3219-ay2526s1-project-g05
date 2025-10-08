import { config } from "dotenv";
import { CollaborationApplication } from "./src/CollaborationApplication.js";

config();

const application = new CollaborationApplication();
application.start();
