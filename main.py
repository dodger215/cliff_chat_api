from flask import Flask, request, jsonify, make_response, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO, emit, join_room, leave_room
from sqlalchemy import desc
from passlib.context import CryptContext
from datetime import datetime, timedelta
import jwt
from functools import wraps
from werkzeug.exceptions import Unauthorized, BadRequest
from key import secret_key
from flask_cors import CORS




app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///./chat.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = secret_key 

db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


CORS(app)

# JWT settings
SECRET_KEY = app.config['SECRET_KEY']
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Models
class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True, index=True)
    email = db.Column(db.String, unique=True, index=True)
    full_name = db.Column(db.String)
    username = db.Column(db.String, unique=True, index=True)
    hashed_password = db.Column(db.String)
    groups = db.relationship('GroupMember', back_populates='user')

class Message(db.Model):
    __tablename__ = "messages"
    id = db.Column(db.Integer, primary_key=True, index=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    receiver_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    content = db.Column(db.String)
    timestamp = db.Column(db.String, default=datetime.utcnow)
    group_id = db.Column(db.Integer, db.ForeignKey("groups.id"), nullable=True)

    sender = db.relationship("User", foreign_keys=[sender_id])
    receiver = db.relationship("User", foreign_keys=[receiver_id])
    group = db.relationship("Group", back_populates="messages")

class Group(db.Model):
    __tablename__ = "groups"
    id = db.Column(db.Integer, primary_key=True, index=True)
    name = db.Column(db.String, unique=True)
    creator_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    created_at = db.Column(db.String, default=datetime.utcnow)
    
    creator = db.relationship("User", foreign_keys=[creator_id])
    members = db.relationship('GroupMember', back_populates='group')
    messages = db.relationship('Message', back_populates='group')

class GroupMember(db.Model):
    __tablename__ = "group_members"
    id = db.Column(db.Integer, primary_key=True, index=True)
    group_id = db.Column(db.Integer, db.ForeignKey("groups.id"))
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    joined_at = db.Column(db.String, default=datetime.utcnow)
    
    group = db.relationship("Group", back_populates="members")
    user = db.relationship("User", back_populates="groups")

# Helper functions
def get_user_by_username(username: str):
    return User.query.filter_by(username=username).first()

def authenticate_user(username: str, password: str):
    user = get_user_by_username(username)
    if not user or not pwd_context.verify(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            raise Unauthorized("Token is missing")
        
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username = payload.get("sub")
            if not username:
                raise Unauthorized("Invalid token")
            current_user = get_user_by_username(username)
            if not current_user:
                raise Unauthorized("User not found")
        except jwt.ExpiredSignatureError:
            raise Unauthorized("Token has expired")
        except jwt.InvalidTokenError:
            raise Unauthorized("Invalid token")
        
        return f(current_user, *args, **kwargs)
    return decorated


@app.after_request
def after_request(response):
    # Add CORS headers
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    
    # Log requests for debugging
    app.logger.info(f"{request.method} {request.path} - {response.status_code}")
    return response



# Routes
@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    if not data or not all(key in data for key in ['email', 'full_name', 'username', 'password']):
        raise BadRequest("Missing required fields")
    
    if User.query.filter_by(username=data['username']).first():
        raise BadRequest("Username already exists")
    
    if User.query.filter_by(email=data['email']).first():
        raise BadRequest("Email already exists")
    
    hashed_password = pwd_context.hash(data['password'])
    new_user = User(
        email=data['email'],
        full_name=data['full_name'],
        username=data['username'],
        hashed_password=hashed_password,
    )
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({
        'id': new_user.id,
        'email': new_user.email,
        'full_name': new_user.full_name,
        'username': new_user.username
    }), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not all(key in data for key in ['username', 'password']):
        raise BadRequest("Username and password required")
    
    user = authenticate_user(data['username'], data['password'])
    if not user:
        raise Unauthorized("Incorrect username or password")
    
    access_token = create_access_token(data={"sub": user.username})
    return jsonify({"access_token": access_token, "token_type": "bearer"})

@app.route('/users', methods=['GET'])
@token_required
def list_users(current_user):
    users = User.query.order_by(User.username).all()
    
    users_data = [{
        'id': user.id,
        'email': user.email,
        'full_name': user.full_name,
        'username': user.username
    } for user in users]
    
    return jsonify(users_data)

@app.route('/users/count', methods=['GET'])
@token_required
def count_users(current_user):
    count = User.query.count()
    return jsonify({"count": count})

@app.route('/groups', methods=['POST'])
@token_required
def create_group(current_user):
    data = request.get_json()
    if not data or not all(key in data for key in ['name', 'user_ids']):
        raise BadRequest("Group name and user IDs required")
    
    if Group.query.filter_by(name=data['name']).first():
        raise BadRequest("Group name already exists")
    
    # Create the group
    new_group = Group(
        name=data['name'],
        creator_id=current_user.id
    )
    db.session.add(new_group)
    db.session.commit()
    
    # Add members to the group (including the creator)
    member_ids = set(data['user_ids'] + [current_user.id])
    for user_id in member_ids:
        member = GroupMember(
            group_id=new_group.id,
            user_id=user_id
        )
        db.session.add(member)
    
    db.session.commit()
    
    return jsonify({
        'id': new_group.id,
        'name': new_group.name,
        'creator_id': new_group.creator_id,
        'created_at': new_group.created_at
    }), 201

@app.route('/groups', methods=['GET'])
@token_required
def list_groups(current_user):
    groups = (
        Group.query
        .join(GroupMember, GroupMember.group_id == Group.id)
        .filter(GroupMember.user_id == current_user.id)
        .order_by(desc(Group.created_at))
        .all()
    )
    
    groups_data = [{
        'id': group.id,
        'name': group.name,
        'creator_id': group.creator_id,
        'created_at': group.created_at
    } for group in groups]
    
    return jsonify(groups_data)

@app.route('/groups/<int:group_id>/messages', methods=['GET'])
@token_required
def get_group_messages(current_user, group_id):
    # Check if user is member of the group
    membership = GroupMember.query.filter_by(
        group_id=group_id,
        user_id=current_user.id
    ).first()
    
    if not membership:
        raise Unauthorized("You are not a member of this group")
    
    messages = (
        Message.query
        .filter_by(group_id=group_id)
        .order_by(Message.timestamp)
        .all()
    )
    
    messages_data = [{
        'id': message.id,
        'sender_id': message.sender_id,
        'content': message.content,
        'timestamp': message.timestamp,
        'sender_username': message.sender.username
    } for message in messages]
    
    return jsonify(messages_data)

# WebSocket handlers
@socketio.on('join_group')
def handle_join_group(data):
    token = data.get('token')
    group_id = data.get('group_id')
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            emit('error', {'message': 'Invalid token'})
            return
        
        user = get_user_by_username(username)
        if not user:
            emit('error', {'message': 'User not found'})
            return
        
        # Check if user is member of the group
        membership = GroupMember.query.filter_by(
            group_id=group_id,
            user_id=user.id
        ).first()
        
        if not membership:
            emit('error', {'message': 'You are not a member of this group'})
            return
        
        join_room(f"group_{group_id}")
        emit('status', {'message': f'Joined group {group_id}'})
        
    except jwt.ExpiredSignatureError:
        emit('error', {'message': 'Token has expired'})
    except jwt.InvalidTokenError:
        emit('error', {'message': 'Invalid token'})

@socketio.on('leave_group')
def handle_leave_group(data):
    token = data.get('token')
    group_id = data.get('group_id')
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            emit('error', {'message': 'Invalid token'})
            return
        
        leave_room(f"group_{group_id}")
        emit('status', {'message': f'Left group {group_id}'})
        
    except jwt.ExpiredSignatureError:
        emit('error', {'message': 'Token has expired'})
    except jwt.InvalidTokenError:
        emit('error', {'message': 'Invalid token'})

@socketio.on('group_message')
def handle_group_message(data):
    token = data.get('token')
    group_id = data.get('group_id')
    content = data.get('content')
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            emit('error', {'message': 'Invalid token'})
            return
        
        user = get_user_by_username(username)
        if not user:
            emit('error', {'message': 'User not found'})
            return
        
        # Check if user is member of the group
        membership = GroupMember.query.filter_by(
            group_id=group_id,
            user_id=user.id
        ).first()
        
        if not membership:
            emit('error', {'message': 'You are not a member of this group'})
            return
        
        # Save message to database
        new_message = Message(
            sender_id=user.id,
            group_id=group_id,
            content=content
        )
        db.session.add(new_message)
        db.session.commit()
        
        # Broadcast message to all group members
        emit('group_message', {
            'sender_id': user.id,
            'sender_username': user.username,
            'content': content,
            'timestamp': new_message.timestamp
        }, room=f"group_{group_id}")
        
    except jwt.ExpiredSignatureError:
        emit('error', {'message': 'Token has expired'})
    except jwt.InvalidTokenError:
        emit('error', {'message': 'Invalid token'})


# Error handlers
@app.errorhandler(Unauthorized)
def handle_unauthorized(error):
    response = jsonify({
        'error': 'Unauthorized',
        'message': str(error.description)
    })
    response.headers['WWW-Authenticate'] = 'Bearer'
    return response, 401


@app.route('/chat')
def chat():
    return app.send_static_file('index.html')



@app.errorhandler(BadRequest)
def handle_bad_request(error):
    return jsonify({
        'error': 'Bad Request',
        'message': str(error.description)
    }), 400

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    socketio.run(app, debug=True)
