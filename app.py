import os
import random
import threading
import time
from datetime import datetime, timedelta

from flask import Flask, request, session, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///echoes.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# ----------------------------- Models -----------------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    class_name = db.Column(db.String(20), nullable=False)
    avatar = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    choices = db.relationship('Choice', backref='user', lazy=True)
    messages_sent = db.relationship('Message', foreign_keys='Message.from_user_id', backref='sender', lazy=True)
    messages_received = db.relationship('Message', foreign_keys='Message.to_user_id', backref='receiver', lazy=True)

class Choice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    slot1 = db.Column(db.String(50))
    slot2 = db.Column(db.String(50))
    slot3 = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    from_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    to_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.String(200), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class TimelineEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    event_type = db.Column(db.String(50))
    event_metadata = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class PlayerProgress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    level = db.Column(db.Integer, default=1)
    xp = db.Column(db.Integer, default=0)
    crystals = db.Column(db.Integer, default=0)
    fragments = db.Column(db.Integer, default=0)
    timeline_health = db.Column(db.Integer, default=100)
    user = db.relationship('User', backref='progress', uselist=False)

class MissionProgress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    mission_id = db.Column(db.Integer, nullable=False)
    progress = db.Column(db.Integer, default=0)
    completed = db.Column(db.Boolean, default=False)

class Inventory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    item_type = db.Column(db.String(50))
    quantity = db.Column(db.Integer, default=0)
    user = db.relationship('User', backref='inventory')

class Timeline(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(50))
    is_active = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class NPC_Memory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    npc_name = db.Column(db.String(50))
    timeline = db.Column(db.String(50))
    trust = db.Column(db.Integer, default=0)
    last_interaction = db.Column(db.DateTime, default=datetime.utcnow)

class FutureMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.String(200))
    scheduled_time = db.Column(db.DateTime)
    is_timed = db.Column(db.Boolean, default=False)
    is_fake = db.Column(db.Boolean, default=False)
    condition_choice = db.Column(db.String(100))
    revealed = db.Column(db.Boolean, default=False)

class GlobalEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    event_name = db.Column(db.String(100))
    threshold = db.Column(db.Integer)
    current_count = db.Column(db.Integer, default=0)
    active = db.Column(db.Boolean, default=False)

class DailyReward(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    last_claimed = db.Column(db.DateTime)
    streak = db.Column(db.Integer, default=0)

class UserLore(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    lore_id = db.Column(db.Integer)
    unlocked_at = db.Column(db.DateTime, default=datetime.utcnow)

class StoryChapter(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    chapter_number = db.Column(db.Integer, nullable=False)
    title = db.Column(db.String(100))
    description = db.Column(db.Text)
    required_level = db.Column(db.Integer, default=1)
    reward_xp = db.Column(db.Integer, default=50)
    reward_crystals = db.Column(db.Integer, default=10)

class UserStoryProgress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    chapter_id = db.Column(db.Integer, nullable=False)
    completed = db.Column(db.Boolean, default=False)
    completed_at = db.Column(db.DateTime)

class CombatEncounter(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    enemy_type = db.Column(db.String(50))
    enemy_hp = db.Column(db.Integer)
    enemy_attack = db.Column(db.Integer)
    reward_xp = db.Column(db.Integer)
    reward_crystals = db.Column(db.Integer)
    required_level = db.Column(db.Integer, default=1)

class UserCombatCooldown(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    encounter_id = db.Column(db.Integer, nullable=False)
    last_fought = db.Column(db.DateTime)

class CraftingRecipe(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    description = db.Column(db.String(200))
    crystals_cost = db.Column(db.Integer, default=0)
    fragments_cost = db.Column(db.Integer, default=0)
    required_level = db.Column(db.Integer, default=1)
    result_item = db.Column(db.String(50))
    result_quantity = db.Column(db.Integer, default=1)

with app.app_context():
    db.create_all()
    if not GlobalEvent.query.first():
        db.session.add(GlobalEvent(event_name="Repair the Timeline", threshold=10))
        db.session.commit()

# ----------------------------- Message Templates -----------------------------
TEMPLATES = {
    'Dreamer': [
        "A glowing hourglass appears in your dream. {day} is the key.",
        "Follow the blue butterfly – it knows the path.",
        "The old library holds a secret on {month} 15th."
    ],
    'Hacker': [
        "Backdoor access at {color} server. Use code 7731.",
        "Encrypted message: sell {asset} before Friday.",
        "Firewall breach detected in {company}. Patch now."
    ],
    'Optimist': [
        "Tomorrow will be brighter. Help someone today.",
        "The sun rises even after the darkest night. Keep going.",
        "A stranger will smile at you. Smile back."
    ],
    'Rebel': [
        "The rally is a trap. Spread the word.",
        "Leak document #{number} from the Green Tower.",
        "Contact {codename} – they are one of us."
    ],
    'Archivist': [
        "Forgotten memory: the bridge collapsed in {month} 1987.",
        "The book in the attic has the missing page.",
        "Your ancestor's diary mentions the clock tower."
    ],
    'Echo': [
        "This message will self‑delete. Don't trust the mirror.",
        "You are not who you think you are.",
        "The Echo speaks: listen to the silence."
    ]
}

def get_random_message(sender_class, _):
    template = random.choice(TEMPLATES.get(sender_class, TEMPLATES['Dreamer']))
    return template.format(
        day=random.choice(['Monday', 'Tuesday', 'Wednesday']),
        month=random.choice(['January', 'April', 'October']),
        color=random.choice(['blue', 'red', 'green']),
        asset=random.choice(['stocks', 'bonds', 'crypto']),
        company=random.choice(['NeoTech', 'Aether', 'OmniCorp']),
        number=random.randint(1, 100),
        codename=random.choice(['Eagle', 'Shadow', 'Phoenix'])
    )

def propagate_messages(trigger_user_id):
    trigger = User.query.get(trigger_user_id)
    candidates = User.query.filter(User.id != trigger_user_id).all()
    if not candidates:
        return
    recipient = random.choice(candidates)
    last_msg = Message.query.filter_by(from_user_id=trigger_user_id, to_user_id=recipient.id).order_by(Message.created_at.desc()).first()
    if last_msg and last_msg.created_at > datetime.utcnow() - timedelta(hours=24):
        return
    content = get_random_message(trigger.class_name, None)
    msg = Message(from_user_id=trigger_user_id, to_user_id=recipient.id, content=content)
    db.session.add(msg)
    db.session.commit()
    socketio.emit('new_message', {'from': trigger.username, 'content': content}, room=str(recipient.id))

def check_collapse(user_id):
    recent = Choice.query.filter_by(user_id=user_id).order_by(Choice.created_at.desc()).limit(3).all()
    if len(recent) < 3:
        return False
    if len({c.slot1 for c in recent}) == 3:
        Message.query.filter_by(from_user_id=user_id).update({'is_active': False})
        event = TimelineEvent(user_id=user_id, event_type='collapse', event_metadata='Contradictory choices')
        db.session.add(event)
        db.session.commit()
        socketio.emit('timeline_collapse', {'username': User.query.get(user_id).username})
        return True
    return False

def update_mission_progress(user_id, mission_id, increment, xp_reward, crystal_reward):
    prog = MissionProgress.query.filter_by(user_id=user_id, mission_id=mission_id).first()
    if not prog:
        prog = MissionProgress(user_id=user_id, mission_id=mission_id, progress=0, completed=False)
        db.session.add(prog)
    if not prog.completed:
        prog.progress += increment
        if prog.progress >= prog.total:
            prog.completed = True
            player_prog = PlayerProgress.query.filter_by(user_id=user_id).first()
            if player_prog:
                player_prog.xp += xp_reward
                player_prog.crystals += crystal_reward
                new_level = 1 + (player_prog.xp // 100)
                player_prog.level = new_level
        db.session.commit()

# ----------------------------- API Routes -----------------------------
@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.json
    username = data.get('username')
    class_name = data.get('class_name')
    if not username or not class_name:
        return jsonify({'error': 'Missing fields'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username taken'}), 400
    user = User(username=username, class_name=class_name)
    db.session.add(user)
    db.session.commit()
    prog = PlayerProgress(user_id=user.id)
    db.session.add(prog)
    db.session.commit()
    session['user_id'] = user.id
    return jsonify({'success': True, 'user_id': user.id})

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    username = data.get('username')
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({'error': 'User not found'}), 400
    session['user_id'] = user.id
    return jsonify({'success': True, 'user_id': user.id})

@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.pop('user_id', None)
    return jsonify({'success': True})

@app.route('/api/me')
def api_me():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    user = User.query.get(session['user_id'])
    return jsonify({
        'id': user.id,
        'username': user.username,
        'class_name': user.class_name,
        'avatar': user.avatar
    })

@app.route('/api/choose_class', methods=['POST'])
def api_choose_class():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.json
    new_class = data.get('class_name')
    user = User.query.get(session['user_id'])
    user.class_name = new_class
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/make_choice', methods=['POST'])
def api_make_choice():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = session['user_id']
    data = request.json
    choice = Choice(user_id=user_id, slot1=data['slot1'], slot2=data['slot2'], slot3=data['slot3'])
    db.session.add(choice)
    db.session.add(TimelineEvent(user_id=user_id, event_type='choice_made', event_metadata=f"{data['slot1']}|{data['slot2']}|{data['slot3']}"))
    db.session.commit()
    propagate_messages(user_id)
    check_collapse(user_id)
    update_mission_progress(user_id, 3, 1, 300, 15)
    
    choice_responses = {
        'Help them': "Your kindness echoes through time. Someone will remember this.",
        'Ignore them': "The stranger fades away. The timeline feels colder.",
        'Read it': "The letter contains a warning: 'Trust no one tomorrow.'",
        'Burn it': "Smoke rises. A whisper says: 'Some truths are better left unknown.'",
        'Investigate': "You discover a glitched memory. A future version of you waves.",
        'Walk away': "The glitch disappears, but you feel you missed something important.",
        'Trust it': "The anonymous echo leads you to a hidden chest with 5 crystals.",
        'Delete it': "The message shatters. You feel a sense of loss."
    }
    response = choice_responses.get(data['slot1'], "The timeline shifts subtly.")
    socketio.emit('new_message', {'from': 'Timeline', 'content': response}, room=str(user_id))
    return jsonify({'success': True})

@app.route('/api/messages')
def api_messages():
    if 'user_id' not in session:
        return jsonify([]), 401
    user_id = session['user_id']
    msgs = Message.query.filter_by(to_user_id=user_id, is_active=True).order_by(Message.created_at.desc()).limit(20).all()
    result = []
    for m in msgs:
        result.append({
            'id': m.id,
            'from': m.sender.username,
            'content': m.content,
            'timestamp': m.created_at.strftime('%H:%M · Branch Δ-7731'),
            'type': 'warning',
            'read': False,
            'selfDeleting': False
        })
    return jsonify(result)

@app.route('/api/timeline_events')
def api_timeline_events():
    if 'user_id' not in session:
        return jsonify([]), 401
    events = TimelineEvent.query.order_by(TimelineEvent.created_at.desc()).limit(20).all()
    return jsonify([{
        'event_type': e.event_type,
        'metadata': e.event_metadata,
        'created_at': e.created_at.isoformat()
    } for e in events])

@app.route('/api/choices')
def api_choices():
    if 'user_id' not in session:
        return jsonify([]), 401
    user_id = session['user_id']
    choices = Choice.query.filter_by(user_id=user_id).order_by(Choice.created_at.desc()).all()
    return jsonify([{
        'slot1': c.slot1,
        'slot2': c.slot2,
        'slot3': c.slot3,
        'created_at': c.created_at.isoformat()
    } for c in choices])

@app.route('/api/progress')
def get_progress():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = session['user_id']
    prog = PlayerProgress.query.filter_by(user_id=user_id).first()
    if not prog:
        prog = PlayerProgress(user_id=user_id)
        db.session.add(prog)
        db.session.commit()
    return jsonify({
        'level': prog.level,
        'xp': prog.xp,
        'crystals': prog.crystals,
        'fragments': prog.fragments,
        'timeline_health': prog.timeline_health
    })

@app.route('/api/add_xp', methods=['POST'])
def add_xp():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    amount = data.get('amount', 0)
    user_id = session['user_id']
    prog = PlayerProgress.query.filter_by(user_id=user_id).first()
    if not prog:
        prog = PlayerProgress(user_id=user_id)
        db.session.add(prog)
    prog.xp += amount
    new_level = 1 + (prog.xp // 100)
    leveled_up = new_level > prog.level
    prog.level = new_level
    db.session.commit()
    return jsonify({'new_xp': prog.xp, 'new_level': prog.level, 'leveled_up': leveled_up})

@app.route('/api/missions')
def get_missions():
    if 'user_id' not in session:
        return jsonify([]), 401
    user_id = session['user_id']
    missions = [
        {'id': 1, 'title': 'Send Your First Echo', 'desc': 'Use the Send tab to transmit a message.', 'total': 1, 'xp_reward': 100, 'crystal_reward': 5},
        {'id': 2, 'title': 'Receive 3 Echoes', 'desc': 'Wait for other players to send you messages.', 'total': 3, 'xp_reward': 250, 'crystal_reward': 10},
        {'id': 3, 'title': 'Make 5 Choices', 'desc': 'Your choices shape the timeline.', 'total': 5, 'xp_reward': 300, 'crystal_reward': 15},
    ]
    results = []
    for m in missions:
        prog = MissionProgress.query.filter_by(user_id=user_id, mission_id=m['id']).first()
        progress = prog.progress if prog else 0
        completed = prog.completed if prog else False
        results.append({**m, 'progress': progress, 'completed': completed})
    return jsonify(results)

@app.route('/api/update_mission', methods=['POST'])
def api_update_mission():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    user_id = session['user_id']
    update_mission_progress(user_id, data['mission_id'], data.get('increment', 1), data.get('xp_reward', 0), data.get('crystal_reward', 0))
    prog = MissionProgress.query.filter_by(user_id=user_id, mission_id=data['mission_id']).first()
    return jsonify({'progress': prog.progress, 'completed': prog.completed})

@app.route('/api/inventory')
def get_inventory():
    if 'user_id' not in session:
        return jsonify([]), 401
    inv = Inventory.query.filter_by(user_id=session['user_id']).all()
    return jsonify([{'type': i.item_type, 'quantity': i.quantity} for i in inv])

@app.route('/api/add_item', methods=['POST'])
def add_item():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    item = Inventory.query.filter_by(user_id=session['user_id'], item_type=data['type']).first()
    if not item:
        item = Inventory(user_id=session['user_id'], item_type=data['type'], quantity=0)
        db.session.add(item)
    item.quantity += data.get('amount', 1)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/timelines')
def get_timelines():
    if 'user_id' not in session:
        return jsonify([]), 401
    timelines = Timeline.query.filter_by(user_id=session['user_id']).all()
    if not timelines:
        default_tls = ['peaceful', 'dystopian', 'glitch']
        for name in default_tls:
            db.session.add(Timeline(user_id=session['user_id'], name=name, is_active=(name=='peaceful')))
        db.session.commit()
        timelines = Timeline.query.filter_by(user_id=session['user_id']).all()
    return jsonify([{'name': t.name, 'active': t.is_active} for t in timelines])

@app.route('/api/switch_timeline', methods=['POST'])
def switch_timeline():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    new_timeline = data.get('timeline')
    Timeline.query.filter_by(user_id=session['user_id']).update({'is_active': False})
    tl = Timeline.query.filter_by(user_id=session['user_id'], name=new_timeline).first()
    if tl:
        tl.is_active = True
    else:
        tl = Timeline(user_id=session['user_id'], name=new_timeline, is_active=True)
        db.session.add(tl)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/npc_memory/<npc_name>')
def get_npc_memory(npc_name):
    if 'user_id' not in session:
        return jsonify({}), 401
    active_tl = Timeline.query.filter_by(user_id=session['user_id'], is_active=True).first()
    timeline_name = active_tl.name if active_tl else 'peaceful'
    mem = NPC_Memory.query.filter_by(user_id=session['user_id'], npc_name=npc_name, timeline=timeline_name).first()
    return jsonify({'trust': mem.trust if mem else 0, 'last': mem.last_interaction.isoformat() if mem else None})

@app.route('/api/update_npc_memory', methods=['POST'])
def update_npc_memory():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    active_tl = Timeline.query.filter_by(user_id=session['user_id'], is_active=True).first()
    timeline_name = active_tl.name if active_tl else 'peaceful'
    mem = NPC_Memory.query.filter_by(user_id=session['user_id'], npc_name=data['npc'], timeline=timeline_name).first()
    if not mem:
        mem = NPC_Memory(user_id=session['user_id'], npc_name=data['npc'], timeline=timeline_name, trust=0)
        db.session.add(mem)
    mem.trust += data.get('delta', 0)
    mem.last_interaction = datetime.utcnow()
    db.session.commit()
    return jsonify({'trust': mem.trust})

@app.route('/api/future_messages')
def get_future_messages():
    if 'user_id' not in session:
        return jsonify([]), 401
    now = datetime.utcnow()
    msgs = FutureMessage.query.filter(
        FutureMessage.user_id == session['user_id'],
        FutureMessage.scheduled_time <= now,
        FutureMessage.revealed == False
    ).all()
    for m in msgs:
        m.revealed = True
    db.session.commit()
    return jsonify([{'content': m.content, 'is_fake': m.is_fake} for m in msgs])

@app.route('/api/add_future_message', methods=['POST'])
def add_future_message():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    msg = FutureMessage(
        user_id=session['user_id'],
        content=data['content'],
        scheduled_time=datetime.utcnow() + timedelta(seconds=data.get('delay_seconds', 60)),
        is_timed=data.get('is_timed', False),
        is_fake=data.get('is_fake', False),
        condition_choice=data.get('condition_choice', '')
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/global_event')
def get_global_event():
    event = GlobalEvent.query.first()
    if not event:
        return jsonify({'name': 'None', 'progress': 0})
    return jsonify({'name': event.event_name, 'progress': event.current_count / event.threshold if event.threshold else 0})

@app.route('/api/contribute_event', methods=['POST'])
def contribute_event():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    event = GlobalEvent.query.first()
    if not event or event.active:
        return jsonify({'message': 'No active event'})
    event.current_count += 1
    if event.current_count >= event.threshold:
        event.active = True
    db.session.commit()
    return jsonify({'active': event.active, 'progress': event.current_count / event.threshold})

@app.route('/api/leaderboard')
def leaderboard():
    users = db.session.query(User.username, PlayerProgress.level, PlayerProgress.xp).join(PlayerProgress).order_by(PlayerProgress.xp.desc()).limit(10).all()
    return jsonify([{'username': u[0], 'level': u[1], 'xp': u[2]} for u in users])

@app.route('/api/send_echo', methods=['POST'])
def send_echo():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    message = data.get('message')
    if not message:
        return jsonify({'error': 'Empty message'}), 400
    sender = User.query.get(session['user_id'])
    recipient = User.query.filter(User.id != session['user_id']).order_by(db.func.random()).first()
    if not recipient:
        return jsonify({'error': 'No other players'}), 400
    msg = Message(from_user_id=sender.id, to_user_id=recipient.id, content=message)
    db.session.add(msg)
    db.session.commit()
    socketio.emit('new_message', {'from': sender.username, 'content': message}, room=str(recipient.id))
    update_mission_progress(session['user_id'], 1, 1, 100, 5)
    return jsonify({'success': True})

@app.route('/api/journal')
def get_journal():
    if 'user_id' not in session:
        return jsonify([]), 401
    user_id = session['user_id']
    choices = Choice.query.filter_by(user_id=user_id).order_by(Choice.created_at.desc()).limit(20).all()
    messages = Message.query.filter_by(to_user_id=user_id).order_by(Message.created_at.desc()).limit(20).all()
    entries = []
    for c in choices:
        entries.append({
            'type': 'choice',
            'content': f"You chose: {c.slot1} / {c.slot2} / {c.slot3}",
            'timestamp': c.created_at.isoformat()
        })
    for m in messages:
        entries.append({
            'type': 'echo',
            'content': f"Echo from {m.sender.username}: {m.content}",
            'timestamp': m.created_at.isoformat()
        })
    entries.sort(key=lambda x: x['timestamp'], reverse=True)
    return jsonify(entries)

@app.route('/api/friends')
def get_friends():
    if 'user_id' not in session:
        return jsonify([]), 401
    user_id = session['user_id']
    sent = db.session.query(Message.from_user_id).filter_by(to_user_id=user_id).distinct().all()
    received = db.session.query(Message.to_user_id).filter_by(from_user_id=user_id).distinct().all()
    friend_ids = set([f[0] for f in sent]) | set([f[0] for f in received])
    friends = User.query.filter(User.id.in_(friend_ids)).all()
    return jsonify([{'username': f.username, 'class': f.class_name} for f in friends if f.id != user_id])

@app.route('/api/claim_daily', methods=['POST'])
def claim_daily():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = session['user_id']
    reward = DailyReward.query.filter_by(user_id=user_id).first()
    if not reward:
        reward = DailyReward(user_id=user_id)
        db.session.add(reward)
    now = datetime.utcnow()
    if reward.last_claimed and (now - reward.last_claimed).days < 1:
        return jsonify({'error': 'Already claimed today'}), 400
    if reward.last_claimed and (now - reward.last_claimed).days == 1:
        reward.streak += 1
    else:
        reward.streak = 1
    reward.last_claimed = now
    crystals = min(10 + reward.streak * 2, 50)
    prog = PlayerProgress.query.filter_by(user_id=user_id).first()
    if prog:
        prog.crystals += crystals
    db.session.commit()
    return jsonify({'crystals': crystals, 'streak': reward.streak})

LORE_DATA = {
    2: "The Echo Network was built in 2084 by Dr. Aris Thorne. He disappeared after the first successful test.",
    5: "There are exactly 7731 known timeline branches. Yours is branch Δ-7731.",
    10: "The original AI, MUSE, still watches. Some say it's waiting for someone to complete the circuit.",
}

@app.route('/api/lore/<int:level>')
def get_lore(level):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = session['user_id']
    already = UserLore.query.filter_by(user_id=user_id, lore_id=level).first()
    if already:
        return jsonify({})
    if level in LORE_DATA:
        new_lore = UserLore(user_id=user_id, lore_id=level)
        db.session.add(new_lore)
        db.session.commit()
        return jsonify({'id': level, 'content': LORE_DATA[level]})
    return jsonify({})

LOCATION_EVENTS = {
    'Central Plaza': {'message': 'You stand in the bustling plaza. Echoes swirl around you.', 'reward': {'crystals': 2, 'fragments': 1, 'xp': 10}},
    'Old Library': {'message': 'Dusty tomes whisper forgotten secrets. You find a hidden journal entry.', 'reward': {'crystals': 1, 'fragments': 2, 'xp': 15}},
    'Sky Gardens': {'message': 'Above the clouds, the timeline is clearer. You gain a vision.', 'reward': {'crystals': 5, 'fragments': 1, 'xp': 25}},
    'Clock Tower': {'message': 'The clock hands spin erratically. A future version of you nods.', 'reward': {'crystals': 3, 'fragments': 3, 'xp': 30}},
}

@app.route('/api/visit_location', methods=['POST'])
def visit_location():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    location = data.get('location')
    if location not in LOCATION_EVENTS:
        return jsonify({'error': 'Unknown location'}), 400
    event = LOCATION_EVENTS[location]
    prog = PlayerProgress.query.filter_by(user_id=session['user_id']).first()
    if not prog:
        prog = PlayerProgress(user_id=session['user_id'])
        db.session.add(prog)
    prog.crystals += event['reward']['crystals']
    prog.fragments += event['reward']['fragments']
    prog.xp += event['reward']['xp']
    new_level = 1 + (prog.xp // 100)
    leveled_up = new_level > prog.level
    prog.level = new_level
    db.session.commit()
    msg = Message(from_user_id=session['user_id'], to_user_id=session['user_id'], content=f"Visit to {location}: {event['message']}")
    db.session.add(msg)
    db.session.commit()
    socketio.emit('new_message', {'from': 'Location', 'content': f"You visited {location}. {event['message']}"}, room=str(session['user_id']))
    return jsonify({'message': event['message'], 'crystals': event['reward']['crystals'], 'fragments': event['reward']['fragments'], 'xp': event['reward']['xp'], 'leveled_up': leveled_up, 'new_level': prog.level})

# ---------- Story Chapters ----------
STORY_CHAPTERS = [
    {"chapter": 1, "title": "The Echo Awakens", "desc": "You discover the Echo Network and learn to send your first message.", "level": 1, "xp": 50, "crystals": 10},
    {"chapter": 2, "title": "The Glitch in Time", "desc": "A temporal anomaly appears. You must investigate the Clock Tower.", "level": 3, "xp": 100, "crystals": 20},
    {"chapter": 3, "title": "Echoes of Betrayal", "desc": "Someone is sending false echoes. Uncover the traitor.", "level": 5, "xp": 150, "crystals": 30},
    {"chapter": 4, "title": "The Fractured Timeline", "desc": "Multiple timelines collide. Restore balance.", "level": 7, "xp": 200, "crystals": 40},
    {"chapter": 5, "title": "The Final Echo", "desc": "Face the source of all echoes and decide the fate of the network.", "level": 10, "xp": 300, "crystals": 100},
]

@app.route('/api/story_chapters')
def get_story_chapters():
    if 'user_id' not in session:
        return jsonify([]), 401
    user_id = session['user_id']
    prog = PlayerProgress.query.filter_by(user_id=user_id).first()
    level = prog.level if prog else 1
    chapters = []
    for ch in STORY_CHAPTERS:
        unlocked = level >= ch['level']
        completed = UserStoryProgress.query.filter_by(user_id=user_id, chapter_id=ch['chapter']).first()
        chapters.append({
            'chapter': ch['chapter'],
            'title': ch['title'],
            'description': ch['desc'],
            'required_level': ch['level'],
            'unlocked': unlocked,
            'completed': completed is not None,
            'reward_xp': ch['xp'],
            'reward_crystals': ch['crystals']
        })
    return jsonify(chapters)

@app.route('/api/complete_chapter', methods=['POST'])
def complete_chapter():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    chapter_num = data.get('chapter')
    already = UserStoryProgress.query.filter_by(user_id=session['user_id'], chapter_id=chapter_num).first()
    if already:
        return jsonify({'error': 'Already completed'}), 400
    ch_data = None
    for ch in STORY_CHAPTERS:
        if ch['chapter'] == chapter_num:
            ch_data = ch
            break
    if not ch_data:
        return jsonify({'error': 'Invalid chapter'}), 400
    prog = PlayerProgress.query.filter_by(user_id=session['user_id']).first()
    if prog:
        prog.xp += ch_data['xp']
        prog.crystals += ch_data['crystals']
        new_level = 1 + (prog.xp // 100)
        leveled_up = new_level > prog.level
        prog.level = new_level
        db.session.commit()
    story_prog = UserStoryProgress(user_id=session['user_id'], chapter_id=chapter_num, completed=True, completed_at=datetime.utcnow())
    db.session.add(story_prog)
    db.session.commit()
    return jsonify({'success': True, 'xp': ch_data['xp'], 'crystals': ch_data['crystals'], 'level_up': leveled_up, 'new_level': prog.level if prog else 1})

# ---------- Combat Encounters ----------
COMBAT_ENCOUNTERS = [
    {"id": 1, "name": "Temporal Wisp", "enemy": "Wisp", "hp": 30, "attack": 5, "xp": 20, "crystals": 5, "level": 1},
    {"id": 2, "name": "Glitch Golem", "enemy": "Golem", "hp": 60, "attack": 10, "xp": 50, "crystals": 10, "level": 3},
    {"id": 3, "name": "Paradox Dragon", "enemy": "Dragon", "hp": 120, "attack": 20, "xp": 100, "crystals": 25, "level": 6},
    {"id": 4, "name": "Echo Reaper", "enemy": "Reaper", "hp": 200, "attack": 35, "xp": 200, "crystals": 50, "level": 10},
]

@app.route('/api/combat_encounters')
def get_combat_encounters():
    if 'user_id' not in session:
        return jsonify([]), 401
    prog = PlayerProgress.query.filter_by(user_id=session['user_id']).first()
    level = prog.level if prog else 1
    encounters = []
    for enc in COMBAT_ENCOUNTERS:
        unlocked = level >= enc['level']
        cd = UserCombatCooldown.query.filter_by(user_id=session['user_id'], encounter_id=enc['id']).first()
        on_cooldown = False
        if cd and cd.last_fought:
            hours_since = (datetime.utcnow() - cd.last_fought).total_seconds() / 3600
            on_cooldown = hours_since < 1
        encounters.append({
            'id': enc['id'],
            'name': enc['name'],
            'enemy': enc['enemy'],
            'hp': enc['hp'],
            'attack': enc['attack'],
            'xp_reward': enc['xp'],
            'crystal_reward': enc['crystals'],
            'unlocked': unlocked,
            'on_cooldown': on_cooldown
        })
    return jsonify(encounters)

@app.route('/api/fight', methods=['POST'])
def fight():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    encounter_id = data.get('encounter_id')
    enc = next((e for e in COMBAT_ENCOUNTERS if e['id'] == encounter_id), None)
    if not enc:
        return jsonify({'error': 'Invalid encounter'}), 400
    prog = PlayerProgress.query.filter_by(user_id=session['user_id']).first()
    if not prog or prog.level < enc['level']:
        return jsonify({'error': 'Level too low'}), 400
    cd = UserCombatCooldown.query.filter_by(user_id=session['user_id'], encounter_id=encounter_id).first()
    if cd and cd.last_fought:
        hours_since = (datetime.utcnow() - cd.last_fought).total_seconds() / 3600
        if hours_since < 1:
            return jsonify({'error': 'On cooldown. Come back later.'}), 400
    player_damage = random.randint(10, 25)
    enemy_damage = random.randint(5, enc['attack'] + 5)
    player_hp = 50 + (prog.level * 10)
    enemy_hp = enc['hp']
    rounds = []
    victory = False
    for round_num in range(1, 10):
        enemy_hp -= player_damage
        rounds.append(f"Round {round_num}: You deal {player_damage} damage. Enemy HP: {max(0, enemy_hp)}")
        if enemy_hp <= 0:
            victory = True
            break
        player_hp -= enemy_damage
        rounds.append(f"Enemy deals {enemy_damage} damage. Your HP: {max(0, player_hp)}")
        if player_hp <= 0:
            victory = False
            break
    if victory:
        prog.xp += enc['xp']
        prog.crystals += enc['crystals']
        new_level = 1 + (prog.xp // 100)
        leveled_up = new_level > prog.level
        prog.level = new_level
        db.session.commit()
        if not cd:
            cd = UserCombatCooldown(user_id=session['user_id'], encounter_id=encounter_id)
            db.session.add(cd)
        cd.last_fought = datetime.utcnow()
        db.session.commit()
        return jsonify({'victory': True, 'xp': enc['xp'], 'crystals': enc['crystals'], 'level_up': leveled_up, 'new_level': prog.level, 'log': rounds})
    else:
        return jsonify({'victory': False, 'log': rounds, 'message': 'You were defeated. Try again after healing.'})

# ---------- Crafting Recipes ----------
CRAFTING_RECIPES = [
    {"id": 1, "name": "Time Crystal Shard", "desc": "Restores 10 timeline health.", "crystals": 0, "fragments": 5, "level": 1, "result": "shard", "quantity": 1},
    {"id": 2, "name": "Echo Booster", "desc": "Increases echo chance for 1 hour.", "crystals": 10, "fragments": 0, "level": 2, "result": "booster", "quantity": 1},
    {"id": 3, "name": "Timeline Stabilizer", "desc": "Restores 25 timeline health and gives 5 XP.", "crystals": 20, "fragments": 10, "level": 4, "result": "stabilizer", "quantity": 1},
    {"id": 4, "name": "Crystal Pouch", "desc": "Contains 15 crystals.", "crystals": 5, "fragments": 5, "level": 3, "result": "crystals", "quantity": 15},
]

@app.route('/api/crafting_recipes')
def get_crafting_recipes():
    if 'user_id' not in session:
        return jsonify([]), 401
    prog = PlayerProgress.query.filter_by(user_id=session['user_id']).first()
    level = prog.level if prog else 1
    recipes = []
    for r in CRAFTING_RECIPES:
        unlocked = level >= r['level']
        recipes.append({
            'id': r['id'],
            'name': r['name'],
            'description': r['desc'],
            'crystals_cost': r['crystals'],
            'fragments_cost': r['fragments'],
            'required_level': r['level'],
            'unlocked': unlocked,
            'result_item': r['result'],
            'result_quantity': r['quantity']
        })
    return jsonify(recipes)

@app.route('/api/craft', methods=['POST'])
def craft():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    recipe_id = data.get('recipe_id')
    recipe = next((r for r in CRAFTING_RECIPES if r['id'] == recipe_id), None)
    if not recipe:
        return jsonify({'error': 'Invalid recipe'}), 400
    prog = PlayerProgress.query.filter_by(user_id=session['user_id']).first()
    if not prog:
        return jsonify({'error': 'No progress'}), 400
    if prog.level < recipe['level']:
        return jsonify({'error': 'Level too low'}), 400
    if prog.crystals < recipe['crystals'] or prog.fragments < recipe['fragments']:
        return jsonify({'error': 'Insufficient materials'}), 400
    prog.crystals -= recipe['crystals']
    prog.fragments -= recipe['fragments']
    if recipe['result'] == 'crystals':
        prog.crystals += recipe['quantity']
    elif recipe['result'] == 'shard':
        prog.timeline_health = min(100, prog.timeline_health + 10)
    elif recipe['result'] == 'booster':
        inv = Inventory.query.filter_by(user_id=session['user_id'], item_type='booster').first()
        if not inv:
            inv = Inventory(user_id=session['user_id'], item_type='booster', quantity=0)
            db.session.add(inv)
        inv.quantity += 1
    elif recipe['result'] == 'stabilizer':
        prog.timeline_health = min(100, prog.timeline_health + 25)
        prog.xp += 5
    db.session.commit()
    return jsonify({'success': True, 'message': f'Crafted {recipe["name"]}!', 'new_crystals': prog.crystals, 'new_fragments': prog.fragments})

# ----------------------------- SocketIO -----------------------------
@socketio.on('connect')
def handle_connect():
    if 'user_id' in session:
        join_room(str(session['user_id']))
        emit('connected', {'message': 'Connected to echo network'})

@socketio.on('disconnect')
def handle_disconnect():
    if 'user_id' in session:
        leave_room(str(session['user_id']))

# ----------------------------- Random Event Loop -----------------------------
def random_event_loop():
    events = [
        "A temporal rift opens near Central Plaza. Crystals rain from the sky.",
        "Echoes of a forgotten future whisper across the network. +5 fragments to all.",
        "The sky flickers – a different timeline bleeds through. Everyone gains 10 XP.",
        "All players receive a mysterious symbol in their journal.",
        "A future version of you is trying to send a warning.",
        "Glitch particles float everywhere. Timeline health slightly restored.",
    ]
    while True:
        time.sleep(120 + random.randint(0, 60))
        event_text = random.choice(events)
        with app.app_context():
            all_users = User.query.all()
            for user in all_users:
                prog = PlayerProgress.query.filter_by(user_id=user.id).first()
                if prog:
                    if 'crystals' in event_text:
                        prog.crystals += 3
                    elif 'fragments' in event_text:
                        prog.fragments += 5
                    elif 'XP' in event_text:
                        prog.xp += 10
                    if 'timeline health' in event_text:
                        prog.timeline_health = min(100, prog.timeline_health + 10)
                    db.session.commit()
            socketio.emit('global_event', {'message': event_text})

threading.Thread(target=random_event_loop, daemon=True).start()

# ----------------------------- Serve React Frontend (Production) -----------------------------
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), 'frontend', 'dist')

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    if path and os.path.exists(os.path.join(FRONTEND_DIST, path)):
        return send_from_directory(FRONTEND_DIST, path)
    return send_from_directory(FRONTEND_DIST, 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, debug=False, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)