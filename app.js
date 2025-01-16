var express = require('express');
var app = express();
var session = require('express-session');
var bcrypt = require('bcrypt');
var conn = require('./dbConfig');
app.set('view engine', 'ejs');
app.use(session({
    secret: 'yoursecret',
    resave: false,
    saveUninitialized: true
}));

app.use('/public', express.static('public'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', function (req, res) {
    res.render("home");
});

app.post('/reg', function (request, response) {
    console.log('Register Request', request.body);

    if (request.body.password != request.body.confirm_password) {
        console.log('Password not match');
        response.redirect('/register');
        response.end();
    } else {
        console.log('Password match');
        // Hash the password

        var hashedPassword = bcrypt.hashSync(request.body.password, 10);
        console.log('Hashed Password', hashedPassword);

        // ADD TO DATABASE

        conn.query(
            'INSERT INTO users (email, password) VALUES (?, ?)',
            [request.body.email, hashedPassword],
            function (error, results, fields) {
                if (error) throw error;
                console.log('User added to database');
                response.redirect('/login');
            },
        );
    }
});

app.post('/auth', function (req, res) {

    // admin login
    conn.query('SELECT * FROM admins WHERE email = ? AND password = ?', [req.body.email, req.body.password], function (adminError, adminResults) {
        if (adminError) throw adminError;

        if (adminResults.length > 0) {
            console.log('Admin found in database', adminResults);
            var admin = adminResults[0];
            console.log('Admin found', admin);
            req.session.email = req.body.email;
            req.session.loggedIn = true;
            req.session.isAdmin = true;
            res.redirect('/adminpage');
            console.log('admin loggedIn status', req.session.loggedIn);

        } else { // Check if normal user
            conn.query('SELECT * FROM users WHERE email = ?', [req.body.email], function (userError, userResults) {
                if (userError) throw userError;

                if (userResults.length > 0) {
                    console.log('User found in user table in the database', userResults);
                    var user = userResults[0];
                    var userPasswordMatch = bcrypt.compareSync(req.body.password, user.password);
                    console.log('Password Match', userPasswordMatch);

                    if (userPasswordMatch) {
                        req.session.email = req.body.email;
                        req.session.loggedIn = true;
                        req.session.isAdmin = false;
                        res.render('contact');
                    } else {
                        res.render('login');
                    }
                } else {
                    res.send('User not found');
                }
            });
        }
    });

    console.log('loggedIn status', req.session.loggedIn);
});

// not admin, user
app.get('/contact', function (req, res, next) {
    if (req.session.loggedIn) {
        res.render('contact');
    } else {
        res.send('Please log in to view this page.');
    }
});
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/eucasoap', function (req, res) {
    res.render("eucasoap");
});
app.get('/lemsoap', function (req, res) {
    res.render("lemsoap");
});
app.get('/lavsoap', function (req, res) {
    res.render("lavsoap");
});
app.get('/candles', function (req, res) {
    res.render("candles");
});
app.get('/products', function (req, res) {
    res.render("products");
});
app.get('/written-pieces', (req, res) => {
    const query = 'SELECT id, title, content, image FROM blogs';
    conn.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching blogs:', error);
            return res.status(500).send('Error fetching blog data');
        }

        // Get view from query parameter (default to 'written-pieces')
        const viewName = req.query.view || 'written-pieces';

        // Render appropriate view ('written-pieces', 'edit-written-piece', etc.)
        res.render(viewName, { blogs: results });
    });
});
app.get('/about', function (req, res) {
    res.render("about");
});
app.get('/shipping', function (req, res) {
    res.render("shipping");
});
app.get('/login', function (req, res) {
    res.render("login");
});
app.get('/register', function (req, res) {
    res.render("register");
});
app.get('/adminpage', function (req, res, next) {
    // Check if the user is logged in and has admin credentials
    if (req.session.loggedIn && req.session.isAdmin) {
        res.render('adminpage'); // Render the admin page
    } else if (req.session.loggedIn) {
        res.status(403).send('Access denied. You do not have permission to view this page.');
    } else {
        res.status(401).send('Please log in as an admin to view this page.');
    }
});
app.get('/add-written-piece', function (req, res) {
    if (req.session.loggedIn && req.session.isAdmin) {
        const query = 'SELECT * FROM blogs'; // Adjust query as needed for your database structure

        conn.query(query, (error, results) => {
            if (error) {
                console.error('Error fetching blogs:', error);
                return res.status(500).send('Error fetching blogs');
            }

            // Pass blogs to the template
            res.render('add-written-piece', { blogs: results });
        });
    } else if (req.session.loggedIn) {
        res.status(403).send('Access denied. You do not have permission to view this page.');
    } else {
        res.status(401).send('Please log in as an admin to view this page.');
    }
});

// Add blog post (Written Pieces)
const multer = require('multer');
const path = require('path');

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory where files will be saved
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname)); // Append original extension
    }
});

app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Initialize multer with storage config
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const isMimeType = allowedTypes.test(file.mimetype);
        const isExtName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (isMimeType && isExtName) {
            return cb(null, true);
        }
        cb(new Error('Invalid file type. Only images are allowed.'));
    },
}).single('image'); // Use .single() here to define middleware

app.post('/add-blog', (req, res) => {
    // Handle file upload
    upload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // Multer-specific errors
            console.error('Multer error:', err);
            return res.status(400).send('File upload error: ' + err.message);
        } else if (err) {
            // Custom error handling for invalid file types
            console.error('File error:', err);
            return res.status(400).send('Error uploading file: ' + err.message);
        }

        // Validate input fields
        const { title, content } = req.body;
        if (!title || !content) {
            return res.status(400).send('Title and content are required.');
        }

        const imagePath = req.file ? req.file.filename : null;

        // Insert text data into the blogs table
        const query = 'INSERT INTO blogs (title, content, image) VALUES (?, ?, ?)';
        conn.query(query, [title, content, imagePath], (err, results) => {
            if (err) {
                console.error('Error inserting blog:', err);
                return res.status(500).send('Error adding blog post: ' + err.message);
            }
            console.log('Blog post added:', results);
            res.redirect('/add-written-piece'); // Redirect to the admin page
        });
    });
});


app.post('/written-pieces/edit/:id', upload, (req, res) => {
    const blogId = req.params.id;
    const { title, content } = req.body;

    const imagePath = req.file ? req.file.filename : null;

    const query = `
        UPDATE blogs
        SET title = ?, content = ? ${imagePath ? ', image = ?' : ''}
        WHERE id = ?
    `;
    const params = imagePath ? [title, content, imagePath, blogId] : [title, content, blogId];

    conn.query(query, params, (error, results) => {
        if (error) {
            console.error('Database Error:', error);
            return res.status(500).send('Error updating blog');
        }
        res.redirect('/written-pieces');
    });
});

app.post('/written-pieces/delete/:id', (req, res) => {
    const blogId = req.params.id;

    const deleteQuery = 'DELETE FROM blogs WHERE id = ?';
    conn.query(deleteQuery, [blogId], (error, results) => {
        if (error) {
            console.error('Error deleting blog:', error);
            return res.status(500).send('Error deleting blog');
        }
        res.redirect('/written-pieces');
    });
});


app.get('/written-piece-details/:id', (req, res) => {

    const blogId = req.params.id;

    const query = 'SELECT * FROM blogs WHERE id = ?';
    conn.query(query, [blogId], (error, results) => {
        if (error) {
            console.error('Error fetching blog:', error);
            return res.status(500).send('Error fetching blog');
        }

        if (results.length === 0) {
            return res.status(404).send('Blog not found');
        }

        const blog = results[0];


        var blogChuncks = blog.content.split('\r\n') // Split by new lines
            .filter(line => line.trim() !== '');

        blog.chunks = blogChuncks;
        // console.log("BLOG: ", blogChuncks);


        res.render('written-piece-details', { blog });
    });
});

// BlogForm Component
/* export const BlogForm = () => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: '', // Set initial content or leave blank
  });

  const handleSubmit = (event) => {
    event.preventDefault();

    // Send formatted content as part of your form submission
    const content = editor.getHTML();
    console.log(content);
    // Use fetch/axios to submit `content` to your backend
  };

  return (
    <form onSubmit={handleSubmit} className="blog-form">
      <div className="form-group">
        <label htmlFor="title">Blog Title:</label>
        <input type="text" id="title" name="title" placeholder="Enter the blog title" required />
      </div>
      <div className="form-group">
        <label htmlFor="content">Blog Content:</label>
        <EditorContent editor={editor} className="editor" />
      </div>
      <button type="submit" className="submit-button">Submit Blog Post</button>
    </form>
  );
};
 */


app.listen(3001);
console.log('Node app is now running on port 3001');