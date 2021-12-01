# Basic Client-Only Web Chat

### Concept


### Components

negotiator.js - reads and writes files in a subdirectory of an s3 bucket.
                the IAM policy of this bucket must be configured such that
                anyone can read any of the files in the directory, but each
                person can only create and delete one particularly named file.
                
connector.js - creates peer-to-peer connections