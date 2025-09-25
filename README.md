## Prosia
A sample React text editor with ProseMirror. 

### Status
The current state is buggy, but the basic features are demonstrable. The code is in the [`js`](./js), with the React app in the [`frontend`](./js/frontend) directory, and the node server in the [`backend`](./js/backend). Run `npm start` in both directories to launch the app. Opening two browser tabs will let you see the changes from one propagating to the other (though this part is buggy and often has wild consequences).

The [`fe`](./fe) and [`be`](./be) directories are from an earlier attempt to create the editor and backend using Rust and `yrs`.