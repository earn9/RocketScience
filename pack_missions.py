import os
import json
import shutil

SOURCE_DIR = 'src/assets/missions'
MISSION_DIR = 'missions'
DEST_DIR = 'dist' + '/' + MISSION_DIR
OUT_FILE = 'src/assets/missions.json'

MISSION_EXTENSION = 'bin'


def copytree(src, dest):
    for item in os.listdir(src):
        shutil.copytree(os.path.join(src, item), os.path.join(dest, item))


def pack_missions():
    print("Packing missions:")

    shutil.rmtree(DEST_DIR, True)
    copytree(SOURCE_DIR, DEST_DIR)

    story_list = []

    for dirName in os.listdir(DEST_DIR):
        if not os.path.isdir(os.path.join(DEST_DIR, dirName)):
            continue

        file_list = []
        story = {'label': dirName}

        for fileName in os.listdir(os.path.join(DEST_DIR, dirName)):
            if not fileName.endswith(MISSION_EXTENSION):
                continue

            mission = {"title": fileName.split('.')[0],
                       "file": os.path.join(MISSION_DIR, dirName, fileName)}

            file_list.append(mission)

            print('- \'' + os.path.join(MISSION_DIR, dirName, fileName) + '\'')

        story['missions'] = file_list
        story_list.append(story)

    missions = {'stories': story_list}

    with open(OUT_FILE, 'w') as file:
        file.write(json.dumps(missions, indent=None, separators=(",", ":")))

if __name__ == '__main__':
    pack_missions()