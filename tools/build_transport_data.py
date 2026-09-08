#!/usr/bin/env python3
import xml.etree.ElementTree as ET
from pathlib import Path
import math,json
ROOT=Path(__file__).resolve().parents[1]
FILES=list((ROOT/"data/osm-filtered").glob("*.osm"))
def hav(a,b):
 R=6371.; p1,p2=map(math.radians,[a[1],b[1]]); dp=math.radians(b[1]-a[1]); dl=math.radians(b[0]-a[0])
 h=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
 return 2*R*math.asin(min(1,math.sqrt(h)))
def build(kind):
 nodes={}; edges=[]
 for fp in FILES:
  root=ET.parse(fp).getroot()
  local={n.attrib["id"]:(float(n.attrib["lon"]),float(n.attrib["lat"])) for n in root.findall("node")}
  for way in root.findall("way"):
   tags={t.attrib["k"]:t.attrib["v"] for t in way.findall("tag")}
   ok=(kind=="car" and tags.get("highway") in {"motorway","motorway_link","trunk","trunk_link"}) or (kind=="train" and tags.get("railway")=="rail" and tags.get("service") not in {"yard","siding","spur"})
   if not ok: continue
   refs=[n.attrib["ref"] for n in way.findall("nd") if n.attrib["ref"] in local]
   for r in refs:nodes[r]=local[r]
   edges += list(zip(refs,refs[1:]))
 used=set(x for e in edges for x in e); mp={old:str(i) for i,old in enumerate(used)}
 outnodes={mp[k]:{"lon":round(nodes[k][0],5),"lat":round(nodes[k][1],5)} for k in used}
 adj={mp[k]:[] for k in used}
 for a,b in edges:
  aa,bb=mp[a],mp[b]; wt=round(hav(nodes[a],nodes[b]),3)
  adj[aa].append([bb,wt]);adj[bb].append([aa,wt])
 return {"nodes":outnodes,"adj":adj}
car,train=build("car"),build("train")
(ROOT/"transport-data.js").write_text("window.CAR_NETWORK="+json.dumps(car,separators=(",",":"))+";\nwindow.TRAIN_NETWORK="+json.dumps(train,separators=(",",":"))+";\n")
print("car",len(car["nodes"]),"train",len(train["nodes"]))
