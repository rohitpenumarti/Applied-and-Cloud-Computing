# Applied-and-Cloud-Computing

This repository contains the homework assignments I have completed as a part of this class. For more information on what each assignment was concerned with, information will be provided on request.

### 7. Final Project
The final project was a group project which involved gathering Spotify track data from a variety of different playlists of varying genres. The goal was to get the user to select a few genres which they prefer and to recommend songs that are anomalys within their given genres according to different metrics computed by Spotify including, but not limited to: danceability, energy, key, loudness. My portion of the code is available to see in this repository and contains code to gather the song metadata using Node.js, as well as uploading this data to S3. Then it also involves my anomaly detection algorithm to detect anomalous songs within the given genres. I used Local Outlier Factor to determine outliers in the data. This script is then run in the main node app which is then served to the frontend React app. Full project can be demo'd on request.
