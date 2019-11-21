//firebase
let db = {}
document.addEventListener("DOMContentLoaded", () => db = firebase.database());

let quor = new Vue({
	el: '#quor',
	data: {
        roomNo:"",
        roomID:"",
        userID:"",
        act:"put",
        LorW:"0",
        team:"",
        ref:{},
        message: '',
        
        sync:{
            host:{
                ID:"",
                wall:"",
            },
            guest:{
                ID:"",
                wall:"",
            },
            turn:"",
            judge:-1,
            board:[],
        },   
    },

    //起動時に実行
	created:function(){
		// firebaseの設定
		this.setFirebase().then(()=>{
            //Boardの初期化
            this.initGame();
		})
    },
    
    computed: {
        team: function() {return this.userID == this.sync.host.ID ? 1 : 2},
        
    },
    //処理
	methods:{
        //firebaseの設定
        setFirebase: function(){
			var firebaseConfig = {
                apiKey: "AIzaSyAQLwF5COgVxCnRmbYbe5XAxCdVz_H4F7c",
                authDomain: "quoridor-954.firebaseapp.com",
                databaseURL: "https://quoridor-954.firebaseio.com",
                projectId: "quoridor-954",
                storageBucket: "quoridor-954.appspot.com",
                messagingSenderId: "567272148614",
                appId: "1:567272148614:web:7401c9224f70e2d8c04b07"
			};
			// Initialize Firebase
			firebase.initializeApp(firebaseConfig);
			
			return new Promise((resolve, reject)=>{
				firebase.database().ref("/.info/serverTimeOffset").on('value', (offset) => {
					var offsetVal = offset.val() || 0;
					this.timestampOffset = offsetVal;
					resolve();
				});
			})
		},

        //Boardの初期化
        initGame:function(){
            //配列の初期化
            this.sync.board = new Array(19);
            for(let y = 0; y < 19; y++) {
                this.sync.board[y] = new Array(19).fill(0);
            }
            this.sync.board[9][1] = 1
            this.sync.board[9][17] = 2
            this.sync.host.wall = 10
            this.sync.guest.wall = 10
            this.sync.judge = -1
        },

        //ルーム作成
        createRoom: async function(){
            //userIDとroomIDを生成
            this.userID = Math.random().toString(36).slice(-8),　//ランダムな8桁の英数字
            this.roomID = Math.floor(Math.random() * 1000);     //ランダムな3桁の数字
            
            //dbを定義
            this.ref = db.ref("/game/" + this.roomID)

            //対称room情報取得
            const snapshot = await this.ref.once("value")

            if(snapshot.val()){
                this.createRoom();
                return;
            }
            this.sync.host.ID = this.userID;
            this.team = 1
            this.sync.turn = -1
            //DBにセット、更新
            this.ref.set(this.sync)
            this.setPush()
        },

        goRoom:async function(){
            if(this.roomNo == ""){
                return;
            }
            //盤面の配色
            quor.setColor();

            //DB参照
            this.ref = this.ref = db.ref("/game/" + this.roomNo)

            //対称room情報取得
            const snapshot = await this.ref.once("value")

            //部屋あるかチェック
            if (!snapshot.val()) {
                alert("no room!"); 
                return
            }
            this.roomID =  this.roomNo

            //DB取得
            this.sync = snapshot.val()

            //guestチェック
            if(this.sync.guest.ID != ""){
                return;
            }

            //userIDをセット
            do{
                this.userID = Math.random().toString(36).slice(-8)　//ランダムな8桁の英数字
            } while(this.userID == this.sync.host.ID)
            this.sync.guest.ID = this.userID;
            this.team = 2

            //turnをランダムに設定 1 or 2
            this.sync.turn = Math.round(Math.random()) + 1

            //DB更新
            this.ref.set(this.sync)
			this.setPush()

        },

        //駒を動かす処理
        put:function(x,y){
            //置けるかチェック
            if(!this.checkput(x,y)){
                return
            }

            for(j=1; j<=17; j=j+2){
                for(i=1; i<=17; i=i+2){
                    if(this.sync.board[i][j] == this.sync.turn){
                        this.sync.board[i][j] = 0
                    }
                }
            }
            //コマの位置をセット
            this.sync.board[x][y] = this.sync.turn
            //勝敗の判定
            this.sync.judge = this.gameJudge(x,y)
            //Turn交代
            this.sync.turn = 3 - this.sync.turn
            //DBにセット、更新
            this.ref.set(this.sync)
            this.setPush()
        },

        //コマを置けるかチェック
        checkput:function(x,y){
            //自分のTurnかチェック
            if (this.sync.turn != this.team){
                 return false
            }

            //actionをチェック
            if(this.act !='put'){
                return false
            }

            wall=0
            //移動前マスの特定
            for(j=1; j<=17; j=j+2){
                for(i=1; i<=17; i=i+2){
                    if(this.sync.board[i][j] == this.sync.turn){
                        x_old = i
                        y_old = j
                    }
                }
            }

            //1マス移動のとき（斜めは含まない）
            if((Math.abs(x_old-x)==2 && y_old==y) ^ (Math.abs(y_old-y) ==2 && x_old==x)){
                //道中の壁の座標と壁ポイント加算
                x_wall = x_old + (x - x_old)/2
                y_wall = y_old + (y - y_old)/2
                wall = this.sync.board[x_wall][y_wall]
            
            //2マス移動のとき（斜めは含まない）->相手がいれば移動可能
            }else if(Math.abs(x_old-x)==4 ^ Math.abs(y_old-y) ==4){
                m = x + (x_old - x)/2
                n = y + (y_old - y)/2

                //相手がいなければfalse
                if(this.sync.board[m][n] != 3 - this.sync.turn){
                    return false

                //相手がいたとき
                }else{
                    ////道中の壁の座標と壁ポイント加算
                    if(x_old == x){
                        wall = wall+this.sync.board[m][n-1] 
                        wall = wall+this.sync.board[m][n+1] 
                    }else if(y_old == y){
                        wall = wall+this.sync.board[m-1][n] 
                        wall = wall+this.sync.board[m+1][n] 
                    }
                }
                
            //斜め1マス移動のとき ->相手がいれば移動可能
            }else if(Math.abs(x_old-x)==2 && Math.abs(y_old-y) ==2){
                m = x + (x_old - x)/2
                n = y + (y_old - y)/2
                //相手がいなければfalse
                if(this.sync.board[x_old][y] == 3 - this.sync.turn){
                    wall = wall+this.sync.board[x_old][n]
                    wall = wall+this.sync.board[m][y]
                }else if(this.sync.board[x][y_old] == 3 - this.sync.turn){
                    wall = wall+this.sync.board[m][y_old]
                    wall = wall+this.sync.board[x][n]
                }else{
                    return false
                }
        
            }else{
                return false
            }

            //道中の壁の有無を判定
            if(wall>0){
                return false
            }
            return true

        },

        //壁を置く処理
        wall:function(x,y){
            //置けるかチェック
            if(!this.checkwall(x,y)){
                return                
            }

            //横
            if(this.LorW=='1'){
                this.sync.board[x-1][y] = 1
                this.sync.board[x][y]   = 1 
                this.sync.board[x+1][y] = 1
            //縦  
            }else{
                this.sync.board[x][y-1] = 1 
                this.sync.board[x][y]   = 1 
                this.sync.board[x][y+1] = 1 
            }
            
            if(this.userID == this.sync.host.ID){
                this.sync.host.wall--
            }else{
                this.sync.guest.wall--
            }
            
            //Turn交代
            this.sync.turn = 3 - this.sync.turn
            this.ref.set(this.sync)
            this.setPush()
        },


        //壁を置けるかチェック
        checkwall:function(x,y){
            //自分のTurnかチェック
            if (this.sync.turn != this.team){
                return false
            }

            //actionをチェック
            if(this.act !='wall'){
                return false
            }

            //壁の枚数をチェック
            if(this.team == 1){
                walls = this.sync.host.wall
            }else if(this.team == 2){
                walls = this.sync.guest.wall
            }
            if(walls == 0){
                return false
            }

            //同じマスチェック
            if(this.sync.board[x][y]==1){
                return false;
            }
            check = 0
            //前後マスチェック
            if(this.LorW==1){
                check += this.sync.board[x][y]
                check += this.sync.board[x-1][y]
                check += this.sync.board[x+1][y]
            }else{
                check += this.sync.board[x][y]
                check += this.sync.board[x][y-1]
                check += this.sync.board[x][y+1]
            }

            if(check > 0){
                return false
            }
            return true
        },

        //勝敗の判定
        gameJudge:function(x,y){
            if((this.team ==1 && y==17) || (this.team ==2 && y==1) ){
                return this.team
            }
            return -1
        },

        gameEnd:function(){
            //-1なら続行
            if(this.sync.judge == -1){
                return
            }
            //操作無効化
            this.sync.turn = -1

            //chrome用にwait
			setTimeout(function(){
				//勝敗出力
				switch(quor.sync.judge) {
					case quor.team: alert("you win!"); break
					case 3 - quor.team: alert("you lose!"); break
				}
				
				//host側で初期化
				if (quor.team == 1) {
					//初期化
                    quor.initGame()
                    quor.sync.turn = Math.round(Math.random()) + 1
					//DBも初期化
					quor.ref.set(quor.sync)
				}
			}, 10)

        },

        //壁の縦横トグル
        switchLorW:　function(){
            this.LorW = ( this.LorW =='0') ? '1' : '0';
        },

        //ローカルに値をセット、反映
        setPush: function(){
            this.ref.on("value", function(snapshot){
                //DBをローカルに反映
                quor.sync = snapshot.val()
                quor.setColor();
                quor.gameEnd();
            })
        },
        
        //Boardの更新（壁と色）
        setColor:function(){
            for(let y = 1; y < 18; y++) {
                for(let x = 1; x < 18; x++) {
                    //マスのとき
                    if(x%2==1 && y%2==1){
                        color = '#F4A460'
                    }else if(x%2==0 && y%2==0){
                        color = (this.sync.board[x][y] == 1) ? '#333333' : '#ffdfba';
                    //壁のとき
                    }else{
                        color = (this.sync.board[x][y] == 1) ? '#333333' : '#FFE4C4';
                    }
                    cell = 'cell' + x + ',' + y
                    document.getElementById(cell).style.backgroundColor = color
                }
            }
        },
        
    },
})