# CineShelf
A mini information system tracker for your watched films.

Backend
-------

A simple Node.js + SQLite backend has been added under the project root.

To run:

```bash
cd "MiniSystem"
npm install
npm start
```

This starts an Express server on port 3000 by default and serves the frontend files. The API endpoints are available under `/api/movies` (GET, POST) and `/api/movies/:id` (GET, DELETE).

