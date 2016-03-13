module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    watch: {
      js: {
        files: ['./**.js'],
        tasks: ['browserify']
      }
    },
    browserify: {
      js: {
        src: './ldpstore.js',
        dest: './ldpframework.js'
      }
    }
  })

  grunt.loadNpmTasks('grunt-browserify')
  grunt.loadNpmTasks('grunt-contrib-watch')
  grunt.registerTask('default', ['watch', 'browserify'])
}
