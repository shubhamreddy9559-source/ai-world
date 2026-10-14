import numpy as np, json
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
from scipy.ndimage import shift, zoom
rng=np.random.default_rng(0)
d=load_digits(); X=d.images/16.0; y=d.target
Xtr,Xte,ytr,yte=train_test_split(X,y,test_size=0.25,random_state=0,stratify=y)
def aug(img):
    out=img
    if rng.random()<.7: out=shift(out,(rng.integers(-1,2),rng.integers(-1,2)),order=1,mode='constant')
    if rng.random()<.5:
        s=rng.uniform(.8,1.1); z=zoom(out,s,order=1)
        c=np.zeros((8,8)); h=min(8,z.shape[0]); o=(8-h)//2; c[o:o+h,o:o+h]=z[:h,:h]; out=c
    return np.clip(out+rng.normal(0,.03,out.shape),0,1)
Xa=np.array([aug(i) for i in Xtr for _ in range(6)]+list(Xtr)); ya=np.concatenate([np.repeat(ytr,6),ytr])
m=MLPClassifier(hidden_layer_sizes=(64,),activation='relu',max_iter=400,random_state=0,alpha=1e-3)
m.fit(Xa.reshape(len(Xa),-1),ya)
acc=m.score(Xte.reshape(len(Xte),-1),yte)
print('held-out accuracy',acc,'train n',len(Xa),'test n',len(Xte))
r=lambda a:np.round(a,3).tolist()
json.dump({'name':'Digit reader (MLP 64-64-10)','dataset':'scikit-learn digits (UCI Optical Recognition of Handwritten Digits), 1797 8x8 images','heldOutAccuracy':round(float(acc),4),'testSamples':int(len(Xte)),'W1':r(m.coefs_[0]),'b1':r(m.intercepts_[0]),'W2':r(m.coefs_[1]),'b2':r(m.intercepts_[1])},open('model/digits.json','w'))
np.save('/tmp/Xte.npy',Xte); np.save('/tmp/yte.npy',yte)
