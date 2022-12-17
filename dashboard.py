import os
import shutil

from flask import Flask
from flask import request
from flask import jsonify
from flask import render_template

from flask_socketio import SocketIO
from werkzeug.utils import secure_filename

from models import dover_model

# import eventlet
# eventlet.monkey_patch()

class utils:
    uploads_path = os.path.join(".", "uploads")

    def zen_file_path(uuid, file_name):
        folder_path = os.path.join(utils.uploads_path, uuid, "")
        if not os.path.isdir(folder_path):
            os.makedirs(folder_path)
        return os.path.abspath(os.path.join(folder_path, file_name))
    
    def clear_content(uuid):
        folder_path = os.path.join(utils.uploads_path, uuid, "")
        shutil.rmtree(folder_path)

app = Flask(__name__)
socketio = SocketIO(app)

@app.route("/")
def upload_file_html():
    return render_template("app-home.html")

@app.route("/assess/<socketid>", methods = ["POST"])
async def assess(socketid):
    uuid = request.args.get("fname")
    uploads = request.files.getlist("files")
    result = []
    for ind, vid in enumerate(uploads):
        print(f"{ind} - Started")
        file_name = secure_filename(vid.filename)
        file_path = utils.zen_file_path(uuid, file_name)
        vid.save(file_path)
        a, b = dover_model.eval(file_path)
        result.append([str(a), str(b)])
        print(f"{ind} - Ended")
        # socketio.emit("update progress", ind * 100 // len(uploads), to=socketid)
    if len(uploads):
        utils.clear_content(uuid)
    return jsonify(data=result)

if __name__ == "__main__":
    app.run(port=5000, debug=True)
    # socketio.run(app=app, port=5000, debug=True)