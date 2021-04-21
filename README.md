# HBD return

Simple script to send HBD to hbdstabilizer if peg is above $1.

## How to run?

clone the repo and from project folder:

```
yarn
export PACCOUNT=ecency
export PKEY=5xxx
export PERIOD=3600000
export THRESHOLD=0.1
node index.js
```

one liner

```
yarn && PACCOUNT=ecency PKEY=5xxx PERIOD=3600000 node index.js
```

Recommended to setup cron task with your selected `period`

```
0 * * * * PACCOUNT=ecency PKEY=5xxx /usr/bin/node $HOME/hbd-return/index.js > $HOME/hbd-return/`date +\%Y\%m\%d\%H\%M\%S`-cron.log
```
