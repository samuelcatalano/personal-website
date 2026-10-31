# female body -> rig proportions: uniform scale to rig height, then piecewise-linear z warp so each joint-ring centroid
# (same vertex indices as the rig bone neighbourhood on NPC_A) lands at NPC_A's height; optional x scale of the torso
import bpy, json, os, sys
import numpy as np
OUT=os.environ["NPC_OUT"]; XS=float(os.environ.get("XS","1.0"))
FOOT_S=float(os.environ.get("FOOT_S","0.93")); HAND_S=float(os.environ.get("HAND_S","0.94"))  # female foot/hand scale about the joint
bpy.ops.wm.open_mainfile(filepath=f"{OUT}/npc_a_walk.blend")
arm=next(o for o in bpy.data.objects if o.type=="ARMATURE")
arm.animation_data.action=None
for pb in arm.pose.bones: pb.location=(0,0,0); pb.rotation_quaternion=(1,0,0,0); pb.scale=(1,1,1)
bpy.context.view_layer.update()
a=max((o for o in bpy.data.objects if o.type=="MESH"),key=lambda o:len(o.data.vertices))
A=np.array([v.co[:] for v in a.data.vertices])
J=["foot_l","calf_l","thigh_l","spine_03","upperarm_l"]
H={n:np.array(arm.data.bones[n].head_local) for n in J}
S={n:np.where(np.linalg.norm(A-H[n],axis=1)<0.06)[0] for n in J}
az=[A[:,2].min()]+[A[S[n],2].mean() for n in J]+[A[:,2].max()]
order=np.argsort(az); 
for nm in sys.argv[sys.argv.index("--")+1:]:
    P=np.array(json.load(open(f"{os.environ['RAW']}/body_NPC_{nm}.json")))
    P=P*(1.8/P[:,2].max()) if False else P
    s=(A[:,2].max()-A[:,2].min())/(P[:,2].max()-P[:,2].min()); P=P*s
    pz=[P[:,2].min()]+[P[S[n],2].mean() for n in J]+[P[:,2].max()]
    o=np.argsort(pz); 
    P[:,2]=np.interp(P[:,2],np.array(pz)[o],np.array(az)[o]) if (np.all(np.diff(np.array(pz)[o])>0) and np.all(np.diff(np.array(az)[o])>0)) else P[:,2]
    # bone-weighted translation: each bone's ring centroid (same vertex indices as on NPC_A) is moved to NPC_A's
    names=[g.name for g in a.vertex_groups]; Wt=np.zeros((len(A),len(names)))
    for v in a.data.vertices:
        for g in v.groups: Wt[v.index,g.group]=g.weight
    num=np.zeros_like(P); den=np.zeros(len(P))
    for k,n in enumerate(names):
        b=arm.data.bones.get(n)
        if b is None: continue
        idx=np.where(np.linalg.norm(A-np.array(b.head_local),axis=1)<0.06)[0]
        if len(idx)<8: continue
        d=(A[idx].mean(0)-P[idx].mean(0))*float(os.environ.get("DAMP","1.0"))
        num+=Wt[:,k:k+1]*d; den+=Wt[:,k]
    P=P+num/np.maximum(den,1e-6)[:,None]*(den>1e-6)[:,None]
    if XS!=1.0: P[:,0]*=XS
    # female feet and hands: the uniform scale up to the rig height enlarges them (foot 27 cm before the runtime scale);
    # shrink each about its own joint (ankle = foot bone head, wrist = hand bone head), weighted by the skin weights
    for grp,piv,k in (("foot","foot",FOOT_S),("ball","foot",FOOT_S),("hand","hand",HAND_S)):
        for sd in "lr":
            names_=[n for n in names if n==f"{grp}_{sd}" or (grp=="hand" and n.endswith(f"_{sd}") and n.split("_")[0] in ("thumb","index","middle","ring","pinky"))]
            w=sum(Wt[:,names.index(n)] for n in names_)
            c=np.array(arm.data.bones[f"{piv}_{sd}"].head_local)
            P=P+(w[:,None]*(k-1.0))*(P-c)
    json.dump([[round(float(c),5) for c in v] for v in P],open(f"{OUT}/body_NPC_{nm}.json","w"))
    print("WARP",nm,"s",round(s,3),"pz",[round(x,3) for x in pz],"az",[round(x,3) for x in az],flush=True)
