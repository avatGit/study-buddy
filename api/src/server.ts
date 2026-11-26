import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';

const app = createApp();

await connectDatabase();
app.listen(env.PORT, () => console.log(`StudyBuddy API listening on port ${env.PORT}`));
