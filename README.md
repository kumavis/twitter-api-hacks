### mad science for the twitter api

status: hacks.

can: dump all followers for user to json

rotates over multiple api credentials.
when out of credentials waits for 15min then rolls over.
handles pagination.

##### usage

set api credentials to config.yml

```
node index.js "username-to-dump"
```